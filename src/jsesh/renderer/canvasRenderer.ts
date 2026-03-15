import type { LayoutBox } from '../layout/cadratLayout'

export interface CanvasRenderOptions {
  strokeStyle?: string
  fillStyle?: string
  textColor?: string
}

const defaultOptions: Required<CanvasRenderOptions> = {
  strokeStyle: '#1f4d6b',
  fillStyle: 'rgba(2, 119, 189, 0.08)',
  textColor: '#17395d',
}

export function renderLayoutToCanvas(
  context: CanvasRenderingContext2D,
  layout: LayoutBox,
  options: CanvasRenderOptions = {},
): void {
  const resolved = { ...defaultOptions, ...options }

  context.save()
  context.strokeStyle = resolved.strokeStyle
  context.fillStyle = resolved.fillStyle
  context.font = '12px monospace'

  renderBox(context, layout, resolved)

  context.restore()
}

function renderBox(
  context: CanvasRenderingContext2D,
  box: LayoutBox,
  options: Required<CanvasRenderOptions>,
): void {
  context.fillStyle = options.fillStyle
  context.strokeStyle = options.strokeStyle
  context.fillRect(box.x, box.y, box.width, box.height)
  context.strokeRect(box.x, box.y, box.width, box.height)

  if (box.label) {
    context.fillStyle = options.textColor
    context.fillText(box.label, box.x + 4, box.y + 14)
  }

  for (const child of box.children) {
    renderBox(context, child, options)
  }
}

export function renderLayoutToSvg(layout: LayoutBox): string {
  const body = renderSvgBox(layout)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}">${body}</svg>`
}

function renderSvgBox(box: LayoutBox): string {
  const rect = `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" fill="rgba(2,119,189,0.08)" stroke="#1f4d6b" />`
  const label = box.label
    ? `<text x="${box.x + 4}" y="${box.y + 14}" fill="#17395d" font-size="12" font-family="monospace">${box.label}</text>`
    : ''
  const children = box.children.map(renderSvgBox).join('')

  return `${rect}${label}${children}`
}