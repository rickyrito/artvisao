<?php
/* Recebe o formulário de contacto e envia-o por email.
   Nota de segurança: nada vindo do visitante entra em cabeçalhos sem validação —
   quebras de linha em From/Reply-To permitiriam injeção de cabeçalhos. */

declare(strict_types=1);

const DESTINO   = 'geral@artvisao.pt';
const REMETENTE = 'geral@artvisao.pt';  // do próprio domínio, para o SPF validar; a resposta vai por Reply-To
const MAX_MSG   = 5000;

function responder(int $status, string $chave, string $texto): void
{
    http_response_code($status);
    if (str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $status === 200, 'key' => $chave], JSON_UNESCAPED_UNICODE);
    } else {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><meta charset="utf-8"><title>Art\'Visão</title>'
           . '<p>' . htmlspecialchars($texto, ENT_QUOTES, 'UTF-8') . '</p>'
           . '<p><a href="index.html#visita">Voltar ao site</a></p>';
    }
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    responder(405, 'method', 'Método não permitido.');
}

// Campo-armadilha: invisível para pessoas, preenchido por robôs.
if (trim((string)($_POST['website'] ?? '')) !== '') {
    responder(200, 'sent', 'Mensagem enviada. Obrigado!');
}

$nome     = trim((string)($_POST['name'] ?? ''));
$email    = trim((string)($_POST['email'] ?? ''));
$mensagem = trim((string)($_POST['message'] ?? ''));

if ($nome === '' || $email === '' || $mensagem === '') {
    responder(422, 'incomplete', 'Preencha todos os campos.');
}
if (mb_strlen($nome) > 120 || mb_strlen($mensagem) > MAX_MSG) {
    responder(422, 'toolong', 'Mensagem demasiado longa.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    responder(422, 'bademail', 'Endereço de email inválido.');
}
// Cabeçalhos só aceitam uma linha; qualquer CR/LF aqui é tentativa de injeção.
if (preg_match('/[\r\n]/', $nome . $email)) {
    responder(422, 'bademail', 'Endereço de email inválido.');
}

$assunto = '=?UTF-8?B?' . base64_encode('Contacto pelo site — ' . $nome) . '?=';
$corpo   = "Nome: {$nome}\nEmail: {$email}\n\nMensagem:\n{$mensagem}\n";
$cabecalhos = implode("\r\n", [
    'From: Art\'Visao <' . REMETENTE . '>',
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
]);

if (!mail(DESTINO, $assunto, $corpo, $cabecalhos)) {
    responder(500, 'failed', 'Não foi possível enviar. Tente por email ou telefone.');
}

responder(200, 'sent', 'Mensagem enviada. Obrigado!');
