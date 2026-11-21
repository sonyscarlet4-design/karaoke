<?php
header('Content-Type: application/json; charset=utf-8');

$host = 'localhost';
$user = 'root';
$pass = '';
$dbName = 'karaoke_nuevo_db';

$conn = new mysqli($host, $user, $pass, $dbName);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Error de conexión a MySQL: ' . $conn->connect_error
    ]);
    exit;
}

$conn->set_charset('utf8mb4');

function obtenerEstadoCompleto(mysqli $conn): array {
    $salas = [];
    $resSalas = $conn->query("SELECT id_sala, nombre_sala, tipo_sala, precio_bs, habilitada FROM salas ORDER BY id_sala ASC");
    while ($resSalas && ($row = $resSalas->fetch_assoc())) {
        $salas[] = $row;
    }

    $carta = [];
    $resCarta = $conn->query("SELECT id_item, categoria, nombre_item, precio_bs, disponible FROM items_carta WHERE disponible = 1 ORDER BY id_item ASC");
    while ($resCarta && ($row = $resCarta->fetch_assoc())) {
        $carta[] = $row;
    }

    $historial = [];
    $resHist = $conn->query("SELECT id_registro, tipo_registro, descripcion, subtotal_bs FROM historial_pedido ORDER BY id_registro ASC");
    while ($resHist && ($row = $resHist->fetch_assoc())) {
        $historial[] = $row;
    }

    return [
        'ok' => true,
        'salas' => $salas,
        'carta' => $carta,
        'historial' => $historial
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    echo json_encode(obtenerEstadoCompleto($conn));
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        $body = $_POST;
    }

    $accion = trim((string)($body['accion'] ?? ''));

    if ($accion === 'registrar_reserva') {
        $nombre = trim((string)($body['nombre'] ?? ''));
        $nota = trim((string)($body['nota'] ?? ''));
        $salaNombre = trim((string)($body['sala_nombre'] ?? 'Sala Privada Acústica'));
        $fecha = trim((string)($body['fecha'] ?? ''));
        $hora = trim((string)($body['hora'] ?? ''));
        $subtotal = (int)($body['subtotal_bs'] ?? 120);

        $idSala = 1;
        $stmtSala = $conn->prepare("SELECT id_sala, precio_bs FROM salas WHERE nombre_sala = ? LIMIT 1");
        if ($stmtSala) {
            $stmtSala->bind_param('s', $salaNombre);
            $stmtSala->execute();
            $resSala = $stmtSala->get_result();
            if ($resSala && ($filaSala = $resSala->fetch_assoc())) {
                $idSala = (int)$filaSala['id_sala'];
                if ($subtotal <= 0) {
                    $subtotal = (int)$filaSala['precio_bs'];
                }
            }
            $stmtSala->close();
        }

        $stmtRes = $conn->prepare(
            "INSERT INTO reservas_sala (id_sala, nombre_cliente, estilo_o_nota, fecha_reserva, hora_reserva, precio_snapshot_bs) VALUES (?, ?, ?, ?, ?, ?)"
        );
        if ($stmtRes) {
            $stmtRes->bind_param('issssi', $idSala, $nombre, $nota, $fecha, $hora, $subtotal);
            $stmtRes->execute();
            $stmtRes->close();
        }

        $descripcion = "{$salaNombre} | Día: {$fecha} | Hora: {$hora} | Cliente: {$nombre} | Nota: {$nota}";
        $tipo = 'Sala';
        $stmtHist = $conn->prepare(
            "INSERT INTO historial_pedido (tipo_registro, descripcion, subtotal_bs) VALUES (?, ?, ?)"
        );
        if ($stmtHist) {
            $stmtHist->bind_param('ssi', $tipo, $descripcion, $subtotal);
            $stmtHist->execute();
            $stmtHist->close();
        }

        $estado = obtenerEstadoCompleto($conn);
        echo json_encode($estado);
        exit;
    }

    if ($accion === 'agregar_item') {
        $tipo = trim((string)($body['tipo'] ?? 'Cóctel'));
        if ($tipo !== 'Cóctel' && $tipo !== 'Comida') {
            $tipo = 'Cóctel';
        }
        $descripcion = trim((string)($body['descripcion'] ?? ''));
        $subtotal = (int)($body['subtotal_bs'] ?? 0);

        $stmt = $conn->prepare(
            "INSERT INTO historial_pedido (tipo_registro, descripcion, subtotal_bs) VALUES (?, ?, ?)"
        );
        if ($stmt) {
            $stmt->bind_param('ssi', $tipo, $descripcion, $subtotal);
            $stmt->execute();
            $stmt->close();
        }

        echo json_encode(obtenerEstadoCompleto($conn));
        exit;
    }

    if ($accion === 'confirmar_pedido') {
        echo json_encode(obtenerEstadoCompleto($conn));
        exit;
    }

    if ($accion === 'limpiar_historial') {
        $conn->query("DELETE FROM historial_pedido");
        echo json_encode(obtenerEstadoCompleto($conn));
        exit;
    }

    http_response_code(400);
    echo json_encode([
        'ok' => false,
        'error' => 'Acción no reconocida.'
    ]);
    exit;
}

http_response_code(405);
echo json_encode([
    'ok' => false,
    'error' => 'Método no permitido.'
]);