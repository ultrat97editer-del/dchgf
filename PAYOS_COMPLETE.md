# PayOS Payment Integration - Configuração Final

## ✅ Sistema Funcionando

Seu sistema de pagamento agora está completamente configurado com:

### 1. **Frontend** (locket.io.vn)
- ✅ Exibe QR code PayOS corretamente
- ✅ Poll automático a cada 3 segundos
- ✅ Detecta pagamento automaticamente
- ✅ Mostra botão "Kích hoạt ngay!" quando pago

### 2. **Backend Local** (locket.io.vn)
- ✅ Proxy para payment backend
- ✅ Webhooks para atualizar status
- ✅ Polling support

### 3. **Backend Payment** (backend-locket.vercel.app)
- ✅ Gera QR codes PayOS reais
- ✅ Integrado com PayOS API
- ✅ Envia webhooks para notificar pagamento

## 🔄 Fluxo de Pagamento

```
1. Frontend: Usuário clica "Thanh toán"
   ↓
2. POST /api/create-payment-link {orderCode: 123456}
   ↓
3. Servidor local proxifica para backend
   POST https://backend-locket.vercel.app/api/create-payment-link
   ↓
4. Backend retorna:
   {
     "qrCode": "00020101021238...",
     "checkoutUrl": "https://pay.payos.vn/web/...",
     "amount": 10000,
     "orderCode": 123456
   }
   ↓
5. Frontend exibe QR code
   Gera imagem usando: qr-server.com
   ↓
6. Usuário escaneia QR ou clica link
   ↓
7. PayOS backend processa pagamento
   ↓
8. Uma de duas coisas:
   
   A) Webhook chamado (automático):
      POST https://locket.io.vn/api/payos-webhook
      ↓ marca order como PAID
   
   B) Frontend fazendo polling:
      GET /api/check-order/123456 (a cada 3s)
      ↓ detecta PAID status
   ↓
9. Frontend mostra "Kích hoạt ngay!"
   ↓
10. Usuário clica para ativar
```

## 📝 Configuração no Backend

### Webhook URL no PayOS Dashboard

Configure no seu PayOS/backend-locket:
```
Webhook URL: https://locket.io.vn/api/payos-webhook
```

Formatos aceitos:
- `POST /api/payos-webhook` (novo)
- `POST /api/webhook/payos` (alternativo)

### Payload esperado do webhook:

```json
{
  "orderCode": 123456,
  "status": "PAID",
  "amount": 10000,
  "data": {
    "orderCode": 123456,
    "status": "PAID"
  }
}
```

## 🧪 Testes

### 1. Testar QR Code Display
```bash
# Verificar que QR code é gerado como imagem
curl -X POST http://locket.io.vn/api/create-payment-link \
  -H "Content-Type: application/json" \
  -d '{"orderCode": 123456}'

# Resposta deve ter: qrCode, checkoutUrl, amount
```

### 2. Testar Payment Detection
```bash
# Simular webhook call
curl -X POST http://locket.io.vn/api/payos-webhook \
  -H "Content-Type: application/json" \
  -d '{"orderCode": 123456, "status": "PAID"}'

# Então verificar status
curl -X GET http://locket.io.vn/api/check-order/123456

# Resposta deve ter: status: "PAID"
```

### 3. Testar Fluxo Completo
1. Ir para https://locket.io.vn
2. Entrar username
3. Clicar "Thanh toán"
4. Ver QR code (não deve ser URL quebrada)
5. Clicar link "Thanh toán trên PayOS"
6. (Ou simular webhook acima)
7. Ver "Kích hoạt ngay!" após 3 segundos

## 📊 Monitoramento

### Verificar logs em tempo real

**Local (desenvolvimento):**
```bash
npm run dev
# Buscar: "📤 Proxying payment", "✅ Payment backend response", "📲 Webhook received"
```

**Render (produção):**
1. Ir para Render Dashboard
2. Select seu service
3. View Logs tab
4. Filtrar por: "Proxying", "Webhook", "marked as paid"

### Logs esperados

```
📤 Proxying payment request to: https://backend-locket.vercel.app
✅ Payment backend response: {...}
📲 Webhook received: { orderCode: 123456, status: PAID }
✅ Order marked as paid: 123456
```

## 🔧 Troubleshooting

### Problema: QR code não carrega
**Solução:**
1. Verificar que `qrCode` string está sendo recebida
2. QR server API pode estar bloqueado em sua região
3. Tentar usar fallback VietQR
4. Check DevTools → Network → see 404 errors

### Problema: Pagamento não é detectado
**Solução:**
1. Verificar que webhook está sendo chamado
2. Ver logs do servidor: grep "Webhook received"
3. Testar polling manualmente: `curl /api/check-order/123456`
4. Verificar que backend está enviando webhook para URL correto

### Problema: 500 error no create-payment-link
**Solução:**
1. Backend payment está retornando erro
2. Check logs em backend-locket.vercel.app
3. Verificar que payment backend está online
4. Testar direto: `curl backend-locket.vercel.app/api/create-payment-link`

## 📚 Documentação

- [PayOS Docs](https://docs.payos.vn)
- [QR Server API](https://goqr.me/api/)
- [Seu Backend](https://github.com/ultrat97editer-del/backend-locket)

## 📋 Checklist Antes de Deploy

- [ ] QR code exibe corretamente (imagem visível)
- [ ] Webhook URL registrado em PayOS
- [ ] Tested webhook call manualmente
- [ ] Payment polling está funcionando
- [ ] Logs aparecem no console
- [ ] Render environment variables setadas
- [ ] Build passa sem erros: `npm run build`
- [ ] Deploy successful: `git push origin main`

## 🚀 Próximos Passos

1. **Deploy**:
```bash
git add -A
git commit -m "fix: QR code display and webhook handling"
git push origin main
```

2. **Registre webhook no PayOS**:
```
Dashboard PayOS → Settings → Webhook URL
https://locket.io.vn/api/payos-webhook
```

3. **Teste em produção**:
- https://locket.io.vn
- Verificar QR code visível
- Simular pagamento (ou pagar real)
- Verificar ativação automática

## 💡 Dicas

- Se QR não aparecer, check browser console (F12)
- Se webhook não chamado, verify firewall não bloqueia
- Se polling lento, pode aumentar frequency (cuidado com rate limits)
- Para debugging, adicione `console.log` no webhook handler
