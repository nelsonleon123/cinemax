-- ====================================================================
-- SCRIPT DE BASE DE DATOS: CINEMAX
-- PROYECTO ACADÉMICO SENA - TADS
-- ====================================================================

-- 1. Habilitar extensión para encriptar contraseñas
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Limpieza de objetos existentes en orden inverso de dependencias
DROP VIEW IF EXISTS vw_ventas_dulceria_por_dia;
DROP VIEW IF EXISTS vw_ventas_por_dia;
DROP VIEW IF EXISTS vw_ventas_por_sala;
DROP VIEW IF EXISTS vw_ventas_por_pelicula;

DROP TRIGGER IF EXISTS trg_detalle_dulceria_after_insert ON detalle_venta_dulceria;
DROP FUNCTION IF EXISTS fn_trg_actualizar_total_dulceria;

DROP TRIGGER IF EXISTS trg_boletos_validar_insert ON boletos;
DROP FUNCTION IF EXISTS fn_trg_boletos_validar_insert;

DROP FUNCTION IF EXISTS fn_vender_dulceria;
DROP FUNCTION IF EXISTS fn_cancelar_boleto;
DROP FUNCTION IF EXISTS fn_comprar_boletos;
DROP FUNCTION IF EXISTS fn_verificar_login;
DROP FUNCTION IF EXISTS fn_crear_usuario;
DROP PROCEDURE IF EXISTS sp_generar_asientos_cine;

DROP TABLE IF EXISTS detalle_venta_dulceria;
DROP TABLE IF EXISTS ventas_dulceria;
DROP TABLE IF EXISTS productos_dulceria;
DROP TABLE IF EXISTS boletos;
DROP TABLE IF EXISTS promociones;
DROP TABLE IF EXISTS funciones;
DROP TABLE IF EXISTS peliculas;
DROP TABLE IF EXISTS asientos;
DROP TABLE IF EXISTS tipos_asiento;
DROP TABLE IF EXISTS salas;
DROP TABLE IF EXISTS usuarios;

-- 3. Creación de Tablas

-- Tabla de Usuarios (Empleados)
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'taquillero')),
    activo BOOLEAN DEFAULT TRUE NOT NULL
);

-- Tabla de Salas
CREATE TABLE salas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

-- Tabla de Tipos de Asiento
CREATE TABLE tipos_asiento (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(20) UNIQUE NOT NULL,
    precio_base NUMERIC(10,2) NOT NULL CHECK (precio_base >= 0)
);

-- Tabla de Asientos
CREATE TABLE asientos (
    id SERIAL PRIMARY KEY,
    sala_id INTEGER NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    tipo_id INTEGER NOT NULL REFERENCES tipos_asiento(id) ON DELETE RESTRICT,
    fila VARCHAR(2) NOT NULL,
    columna INTEGER NOT NULL,
    etiqueta VARCHAR(10) NOT NULL,
    CONSTRAINT uq_sala_fila_columna UNIQUE (sala_id, fila, columna)
);

-- Tabla de Películas
CREATE TABLE peliculas (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(150) NOT NULL,
    duracion INTEGER NOT NULL CHECK (duracion > 0), -- duración en minutos
    genero VARCHAR(50) NOT NULL,
    sinopsis TEXT NOT NULL,
    imagen_url TEXT NOT NULL
);

-- Tabla de Funciones
CREATE TABLE funciones (
    id SERIAL PRIMARY KEY,
    pelicula_id INTEGER NOT NULL REFERENCES peliculas(id) ON DELETE CASCADE,
    sala_id INTEGER NOT NULL REFERENCES salas(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    -- Una sala no puede tener dos funciones programadas a la misma fecha y hora
    CONSTRAINT uq_funcion_sala_fecha_hora UNIQUE (sala_id, fecha, hora)
);

-- Tabla de Promociones
CREATE TABLE promociones (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descripcion TEXT NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo')),
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    activa BOOLEAN DEFAULT TRUE NOT NULL,
    CONSTRAINT chk_fechas_promo CHECK (fecha_fin >= fecha_inicio)
);

-- Tabla de Boletos
CREATE TABLE boletos (
    id SERIAL PRIMARY KEY,
    codigo_unico VARCHAR(20) UNIQUE,
    funcion_id INTEGER NOT NULL REFERENCES funciones(id) ON DELETE CASCADE,
    asiento_id INTEGER NOT NULL REFERENCES asientos(id) ON DELETE RESTRICT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    comprador VARCHAR(100) NOT NULL,
    precio_original NUMERIC(10,2), -- Autocalculado por trigger
    precio_pagado NUMERIC(10,2),   -- Autocalculado por trigger
    promocion_id INTEGER REFERENCES promociones(id) ON DELETE SET NULL,
    fecha_expedicion TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    estado VARCHAR(20) DEFAULT 'vendido' NOT NULL CHECK (estado IN ('vendido', 'cancelado'))
);

-- Índice único parcial para evitar duplicación de asientos en la misma función (solo boletos vendidos)
CREATE UNIQUE INDEX idx_boleto_vendido_asiento_funcion 
ON boletos (funcion_id, asiento_id) 
WHERE (estado = 'vendido');

-- Tabla de Productos de Dulcería
CREATE TABLE productos_dulceria (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    precio NUMERIC(10,2) NOT NULL CHECK (precio >= 0),
    imagen_url TEXT NOT NULL
);

-- Tabla de Ventas de Dulcería
CREATE TABLE ventas_dulceria (
    id SERIAL PRIMARY KEY,
    codigo_unico VARCHAR(20) UNIQUE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    comprador VARCHAR(100) NOT NULL,
    total NUMERIC(10,2) DEFAULT 0 NOT NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Tabla de Detalle de Ventas de Dulcería
CREATE TABLE detalle_venta_dulceria (
    id SERIAL PRIMARY KEY,
    venta_id INTEGER NOT NULL REFERENCES ventas_dulceria(id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES productos_dulceria(id) ON DELETE RESTRICT,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0)
);

-- ====================================================================
-- 4. Procedimientos Almacenados y Funciones
-- ====================================================================

-- Procedimiento para autogenerar asientos de las 3 salas fijas
CREATE OR REPLACE PROCEDURE sp_generar_asientos_cine()
LANGUAGE plpgsql
AS $$
DECLARE
    v_sala_grande_id INT;
    v_sala_catering_id INT;
    v_sala_vip_id INT;
    v_tipo_basica_id INT;
    v_tipo_vip_id INT;
    v_tipo_palomera_id INT;
    r CHAR(1);
    c INT;
    v_tipo_id INT;
    v_etiqueta VARCHAR(10);
BEGIN
    -- Obtener IDs de las salas
    SELECT id INTO v_sala_grande_id FROM salas WHERE nombre = 'Sala Grande';
    SELECT id INTO v_sala_catering_id FROM salas WHERE nombre = 'Sala Catering';
    SELECT id INTO v_sala_vip_id FROM salas WHERE nombre = 'Sala VIP';
    
    -- Obtener IDs de los tipos de asiento
    SELECT id INTO v_tipo_basica_id FROM tipos_asiento WHERE nombre = 'básica';
    SELECT id INTO v_tipo_vip_id FROM tipos_asiento WHERE nombre = 'VIP';
    SELECT id INTO v_tipo_palomera_id FROM tipos_asiento WHERE nombre = 'palomera';

    IF v_sala_grande_id IS NULL OR v_sala_catering_id IS NULL OR v_sala_vip_id IS NULL THEN
        RAISE EXCEPTION 'Las salas requeridas no existen en la base de datos.';
    END IF;

    -- Limpiar asientos existentes
    DELETE FROM asientos;

    -- 1. Sala Grande: 120 básicas, 20 VIP y 60 palomeras.
    -- Diseñamos con 10 filas (A a J) y 20 columnas (1 a 20) = 200 asientos
    -- Filas A - F (6 filas * 20 = 120 asientos): básica
    -- Fila G (1 fila * 20 = 20 asientos): VIP
    -- Filas H - J (3 filas * 20 = 60 asientos): palomera
    FOR r IN SELECT unnest(ARRAY['A','B','C','D','E','F','G','H','I','J']) LOOP
        IF r IN ('A','B','C','D','E','F') THEN
            v_tipo_id := v_tipo_basica_id;
        ELSIF r = 'G' THEN
            v_tipo_id := v_tipo_vip_id;
        ELSE
            v_tipo_id := v_tipo_palomera_id;
        END IF;

        FOR c IN 1..20 LOOP
            v_etiqueta := r || c::text;
            INSERT INTO asientos (sala_id, tipo_id, fila, columna, etiqueta)
            VALUES (v_sala_grande_id, v_tipo_id, r, c, v_etiqueta);
        END LOOP;
    END LOOP;

    -- 2. Sala Catering: 20 VIP y 60 palomeras.
    -- Diseñamos con 4 filas (A a D) y 20 columnas (1 a 20) = 80 asientos
    -- Fila A (1 fila * 20 = 20 asientos): VIP
    -- Filas B - D (3 filas * 20 = 60 asientos): palomera
    FOR r IN SELECT unnest(ARRAY['A','B','C','D']) LOOP
        IF r = 'A' THEN
            v_tipo_id := v_tipo_vip_id;
        ELSE
            v_tipo_id := v_tipo_palomera_id;
        END IF;

        FOR c IN 1..20 LOOP
            v_etiqueta := r || c::text;
            INSERT INTO asientos (sala_id, tipo_id, fila, columna, etiqueta)
            VALUES (v_sala_catering_id, v_tipo_id, r, c, v_etiqueta);
        END LOOP;
    END LOOP;

    -- 3. Sala VIP: 60 asientos VIP (6x10)
    -- Diseñamos con 6 filas (A a F) y 10 columnas (1 a 10) = 60 asientos (todos VIP)
    FOR r IN SELECT unnest(ARRAY['A','B','C','D','E','F']) LOOP
        v_tipo_id := v_tipo_vip_id;
        FOR c IN 1..10 LOOP
            v_etiqueta := r || c::text;
            INSERT INTO asientos (sala_id, tipo_id, fila, columna, etiqueta)
            VALUES (v_sala_vip_id, v_tipo_id, r, c, v_etiqueta);
        END LOOP;
    END LOOP;
END;
$$;

-- Función para encriptar contraseñas e insertar usuario nuevo
CREATE OR REPLACE FUNCTION fn_crear_usuario(
    p_username VARCHAR,
    p_password VARCHAR,
    p_nombre VARCHAR,
    p_rol VARCHAR
) RETURNS INT AS $$
DECLARE
    v_user_id INT;
BEGIN
    INSERT INTO usuarios (username, password, nombre, rol)
    VALUES (p_username, crypt(p_password, gen_salt('bf', 8)), p_nombre, p_rol)
    RETURNING id INTO v_user_id;
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

-- Función para verificar login de usuario
CREATE OR REPLACE FUNCTION fn_verificar_login(
    p_username VARCHAR,
    p_password VARCHAR
) RETURNS TABLE(
    id INT,
    username VARCHAR,
    nombre VARCHAR,
    rol VARCHAR,
    activo BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.username, u.nombre, u.rol, u.activo
    FROM usuarios u
    WHERE u.username = p_username 
      AND u.password = crypt(p_password, u.password) 
      AND u.activo = true;
END;
$$ LANGUAGE plpgsql;

-- Función para comprar múltiples boletos
CREATE OR REPLACE FUNCTION fn_comprar_boletos(
    p_funcion_id INT,
    p_asiento_ids INT[],
    p_usuario_id INT,
    p_comprador VARCHAR,
    p_promo_codigo VARCHAR DEFAULT NULL
) RETURNS TABLE(
    id INT,
    codigo_unico VARCHAR,
    funcion_id INT,
    asiento_id INT,
    precio_original NUMERIC,
    precio_pagado NUMERIC,
    comprador VARCHAR,
    asiento_etiqueta VARCHAR
) AS $$
DECLARE
    v_promo_id INT := NULL;
    v_asiento_id INT;
BEGIN
    -- Validar promoción si se provee un código
    IF p_promo_codigo IS NOT NULL AND p_promo_codigo <> '' THEN
        SELECT p.id INTO v_promo_id
        FROM promociones p
        WHERE p.codigo = UPPER(TRIM(p_promo_codigo));
        
        IF v_promo_id IS NULL THEN
            RAISE EXCEPTION 'El código de promoción % no existe.', p_promo_codigo;
        END IF;
    END IF;

    -- Registrar cada boleto. El trigger calculará precios, códigos y validará la sala.
    FOREACH v_asiento_id IN ARRAY p_asiento_ids LOOP
        INSERT INTO boletos (funcion_id, asiento_id, usuario_id, comprador, promocion_id, estado)
        VALUES (p_funcion_id, v_asiento_id, p_usuario_id, p_comprador, v_promo_id, 'vendido');
    END LOOP;

    -- Retornar datos detallados de los boletos vendidos en esta compra
    RETURN QUERY
    SELECT b.id, b.codigo_unico, b.funcion_id, b.asiento_id, b.precio_original, b.precio_pagado, b.comprador, a.etiqueta
    FROM boletos b
    JOIN asientos a ON b.asiento_id = a.id
    WHERE b.funcion_id = p_funcion_id 
      AND b.asiento_id = ANY(p_asiento_ids) 
      AND b.estado = 'vendido'
      AND b.usuario_id = p_usuario_id;
END;
$$ LANGUAGE plpgsql;

-- Función para cancelar un boleto
CREATE OR REPLACE FUNCTION fn_cancelar_boleto(
    p_codigo_boleto VARCHAR
) RETURNS VOID AS $$
BEGIN
    UPDATE boletos
    SET estado = 'cancelado'
    WHERE codigo_unico = UPPER(TRIM(p_codigo_boleto)) AND estado = 'vendido';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Boleto no encontrado o ya cancelado.';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar venta de dulcería
CREATE OR REPLACE FUNCTION fn_vender_dulceria(
    p_usuario_id INT,
    p_comprador VARCHAR,
    p_productos_json JSONB
) RETURNS INT AS $$
DECLARE
    v_venta_id INT;
    v_codigo VARCHAR;
    v_item RECORD;
    v_precio NUMERIC;
BEGIN
    -- Validar que el json no esté vacío
    IF p_productos_json IS NULL OR jsonb_array_length(p_productos_json) = 0 THEN
        RAISE EXCEPTION 'La venta debe contener al menos un producto.';
    END IF;

    -- Generar código único de transacción
    LOOP
        v_codigo := 'DUL-' || UPPER(substring(md5(random()::text) from 1 for 6));
        EXIT WHEN NOT EXISTS(SELECT 1 FROM ventas_dulceria WHERE codigo_unico = v_codigo);
    END LOOP;

    -- Insertar venta maestra con total en 0 (el trigger AFTER INSERT en detalle lo actualizará)
    INSERT INTO ventas_dulceria (codigo_unico, usuario_id, comprador, total)
    VALUES (v_codigo, p_usuario_id, p_comprador, 0)
    RETURNING id INTO v_venta_id;

    -- Insertar detalles
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_productos_json) AS x(producto_id INT, cantidad INT) LOOP
        -- Obtener precio del producto
        SELECT precio INTO v_precio FROM productos_dulceria WHERE id = v_item.producto_id;
        IF v_precio IS NULL THEN
            RAISE EXCEPTION 'El producto con ID % no existe.', v_item.producto_id;
        END IF;

        INSERT INTO detalle_venta_dulceria (venta_id, producto_id, cantidad, precio_unitario)
        VALUES (v_venta_id, v_item.producto_id, v_item.cantidad, v_precio);
    END LOOP;

    RETURN v_venta_id;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- 5. Triggers de Base de Datos
-- ====================================================================

-- Trigger Función: Validar asiento, autocalcular precio y código único de boleto
CREATE OR REPLACE FUNCTION fn_trg_boletos_validar_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_sala_func_id INT;
    v_sala_asiento_id INT;
    v_precio_base NUMERIC;
    v_promo_tipo VARCHAR;
    v_promo_valor NUMERIC;
    v_promo_inicio DATE;
    v_promo_fin DATE;
    v_promo_activa BOOLEAN;
BEGIN
    -- 1. Validar que el asiento y la función pertenezcan a la misma sala
    SELECT sala_id INTO v_sala_func_id FROM funciones WHERE id = NEW.funcion_id;
    SELECT sala_id INTO v_sala_asiento_id FROM asientos WHERE id = NEW.asiento_id;

    IF v_sala_func_id IS NULL THEN
        RAISE EXCEPTION 'La función con ID % no existe.', NEW.funcion_id;
    END IF;

    IF v_sala_asiento_id IS NULL THEN
        RAISE EXCEPTION 'El asiento seleccionado no existe.';
    END IF;

    IF v_sala_func_id <> v_sala_asiento_id THEN
        RAISE EXCEPTION 'El asiento no pertenece a la sala de la función programada.';
    END IF;

    -- 2. Obtener precio base de acuerdo al tipo de asiento
    SELECT ta.precio_base INTO v_precio_base
    FROM asientos a
    JOIN tipos_asiento ta ON a.tipo_id = ta.id
    WHERE a.id = NEW.asiento_id;

    NEW.precio_original := v_precio_base;

    -- 3. Calcular precio con promoción (si aplica)
    IF NEW.promocion_id IS NOT NULL THEN
        SELECT tipo, valor, fecha_inicio, fecha_fin, activa
        INTO v_promo_tipo, v_promo_valor, v_promo_inicio, v_promo_fin, v_promo_activa
        FROM promociones
        WHERE id = NEW.promocion_id;

        IF v_promo_activa IS NOT TRUE OR CURRENT_DATE < v_promo_inicio OR CURRENT_DATE > v_promo_fin THEN
            RAISE EXCEPTION 'La promoción no está activa o ya ha expirado.';
        END IF;

        IF v_promo_tipo = 'porcentaje' THEN
            NEW.precio_pagado := v_precio_base - (v_precio_base * (v_promo_valor / 100.0));
        ELSIF v_promo_tipo = 'monto_fijo' THEN
            NEW.precio_pagado := v_precio_base - v_promo_valor;
        END IF;

        -- Evitar precios negativos por promociones mal configuradas
        IF NEW.precio_pagado < 0 THEN
            NEW.precio_pagado := 0;
        END IF;
    ELSE
        NEW.precio_pagado := v_precio_base;
    END IF;

    -- 4. Generar código único aleatorio si es nulo
    IF NEW.codigo_unico IS NULL THEN
        LOOP
            NEW.codigo_unico := 'BOL-' || UPPER(substring(md5(random()::text) from 1 for 8));
            EXIT WHEN NOT EXISTS(SELECT 1 FROM boletos WHERE codigo_unico = NEW.codigo_unico);
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_boletos_validar_insert
BEFORE INSERT ON boletos
FOR EACH ROW
EXECUTE FUNCTION fn_trg_boletos_validar_insert();

-- Trigger Función: Actualizar total en ventas de dulcería
CREATE OR REPLACE FUNCTION fn_trg_actualizar_total_dulceria()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ventas_dulceria
    SET total = (
        SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
        FROM detalle_venta_dulceria
        WHERE venta_id = COALESCE(NEW.venta_id, OLD.venta_id)
    )
    WHERE id = COALESCE(NEW.venta_id, OLD.venta_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_detalle_dulceria_after_insert
AFTER INSERT OR UPDATE OR DELETE ON detalle_venta_dulceria
FOR EACH ROW
EXECUTE FUNCTION fn_trg_actualizar_total_dulceria();

-- ====================================================================
-- 6. Vistas de Reportes (Solo boletos con estado = 'vendido')
-- ====================================================================

-- Reporte 1: Ventas por Película
CREATE OR REPLACE VIEW vw_ventas_por_pelicula AS
SELECT 
    p.id AS pelicula_id,
    p.titulo AS pelicula_titulo,
    COUNT(b.id) AS boletos_vendidos,
    COALESCE(SUM(b.precio_pagado), 0) AS total_recaudado
FROM peliculas p
LEFT JOIN funciones f ON p.id = f.pelicula_id
LEFT JOIN boletos b ON f.id = b.funcion_id AND b.estado = 'vendido'
GROUP BY p.id, p.titulo
ORDER BY total_recaudado DESC;

-- Reporte 2: Ventas por Sala
CREATE OR REPLACE VIEW vw_ventas_por_sala AS
SELECT 
    s.id AS sala_id,
    s.nombre AS sala_nombre,
    COUNT(b.id) AS boletos_vendidos,
    COALESCE(SUM(b.precio_pagado), 0) AS total_recaudado
FROM salas s
LEFT JOIN funciones f ON s.id = f.sala_id
LEFT JOIN boletos b ON f.id = b.funcion_id AND b.estado = 'vendido'
GROUP BY s.id, s.nombre
ORDER BY total_recaudado DESC;

-- Reporte 3: Ventas de Boletos por Día
CREATE OR REPLACE VIEW vw_ventas_por_dia AS
SELECT 
    DATE(b.fecha_expedicion) AS fecha,
    COUNT(b.id) AS boletos_vendidos,
    COALESCE(SUM(b.precio_pagado), 0) AS total_recaudado
FROM boletos b
WHERE b.estado = 'vendido'
GROUP BY DATE(b.fecha_expedicion)
ORDER BY fecha DESC;

-- Reporte 4: Ventas de Dulcería por Día
CREATE OR REPLACE VIEW vw_ventas_dulceria_por_dia AS
SELECT 
    DATE(v.fecha_venta) AS fecha,
    COUNT(v.id) AS transacciones,
    COALESCE(SUM(v.total), 0) AS total_recaudado
FROM ventas_dulceria v
GROUP BY DATE(v.fecha_venta)
ORDER BY fecha DESC;

-- ====================================================================
-- 7. Carga de Datos Iniciales (Semillas)
-- ====================================================================

-- Salas Fijas
INSERT INTO salas (nombre) VALUES 
('Sala Grande'),
('Sala Catering'),
('Sala VIP');

-- Tipos de Asiento con precios base
INSERT INTO tipos_asiento (nombre, precio_base) VALUES 
('básica', 12000.00),
('VIP', 25000.00),
('palomera', 20000.00);

-- Generar los Asientos automáticamente llamando al procedimiento
CALL sp_generar_asientos_cine();

-- Usuarios Iniciales (Admin y Taquillero)
-- admin / admin123
-- taquillero / taquillero123
SELECT fn_crear_usuario('admin', 'admin123', 'Administrador Principal', 'administrador');
SELECT fn_crear_usuario('taquillero', 'taquillero123', 'Juan Pérez (Taquillero)', 'taquillero');

-- Películas de Muestra
INSERT INTO peliculas (titulo, duracion, genero, sinopsis, imagen_url) VALUES 
('Inception', 148, 'Sci-Fi', 'Un ladrón que roba secretos corporativos a través del uso de la tecnología de compartir sueños, tiene la tarea inversa de plantar una idea en la mente de un director general.', 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=800&q=80'),
('Avatar: The Way of Water', 192, 'Acción', 'Jake Sully vive con su nueva familia en el planeta de Pandora. Cuando una amenaza conocida regresa, Jake debe trabajar con Neytiri y el ejército de la raza Na''vi para proteger su planeta.', 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=800&q=80'),
('Spirited Away', 125, 'Animación', 'Durante la mudanza de su familia a los suburbios, una niña de 10 años de edad deambula por un mundo gobernado por dioses, brujas y espíritus, y donde los humanos se convierten en bestias.', 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80');

-- Funciones de Muestra (Para hoy y mañana)
-- Asumiremos algunas horas fijas
INSERT INTO funciones (pelicula_id, sala_id, fecha, hora) VALUES 
(1, 1, CURRENT_DATE, '15:00:00'),
(1, 1, CURRENT_DATE, '19:00:00'),
(2, 2, CURRENT_DATE, '14:30:00'),
(2, 2, CURRENT_DATE, '18:30:00'),
(3, 3, CURRENT_DATE, '16:00:00'),
(3, 3, CURRENT_DATE, '20:00:00'),
-- Mañana
(1, 1, CURRENT_DATE + 1, '15:00:00'),
(2, 2, CURRENT_DATE + 1, '18:30:00'),
(3, 3, CURRENT_DATE + 1, '20:00:00');

-- Promociones de Muestra
INSERT INTO promociones (codigo, descripcion, tipo, valor, fecha_inicio, fecha_fin, activa) VALUES 
('MITAD', '50% de descuento en el boleto', 'porcentaje', 50.00, '2026-01-01', '2026-12-31', TRUE),
('AHORRO5K', '$5.000 pesos de descuento en el boleto', 'monto_fijo', 5000.00, '2026-01-01', '2026-12-31', TRUE),
('PROMOEXPIRED', 'Promoción antigua ya vencida', 'porcentaje', 20.00, '2020-01-01', '2020-12-31', TRUE);

-- Productos de Dulcería de Muestra
INSERT INTO productos_dulceria (nombre, precio, imagen_url) VALUES 
('Combo 1 (Crispetas Grandes + Gaseosa)', 18000.00, 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=800&q=80'),
('Combo Pareja (2 Crispetas Medianas + 2 Gaseosas)', 32000.00, 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=800&q=80'),
('Crispetas Grandes', 12000.00, 'https://images.unsplash.com/photo-1578849278619-e73505e9610f?auto=format&fit=crop&w=800&q=80'),
('Gaseosa Grande', 7000.00, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80'),
('Perro Caliente', 10000.00, 'https://images.unsplash.com/photo-1619740455993-9e612b1af08a?auto=format&fit=crop&w=800&q=80'),
('Chocolates M&M', 6000.00, 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?auto=format&fit=crop&w=800&q=80');
