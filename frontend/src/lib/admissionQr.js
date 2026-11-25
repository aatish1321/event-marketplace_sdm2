import qrcode from 'qrcode-generator'

export function admissionQrDataUrl(code) {
  const qr = qrcode(0, 'M')
  qr.addData(code, 'Byte')
  qr.make()
  return qr.createDataURL(6, 24)
}
