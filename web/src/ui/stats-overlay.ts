import type { FamilyGenealogy } from '../game/family-registry'
import { formatGenealogyLine } from '../game/family-registry'
import type { FamilyMarketRecord } from '../game/family-market'
import { ORDER_DEMAND_LABEL } from '../game/family-market'
import type { OrderStatsSummary } from '../game/production-stats'
import { listAllOrders } from '../game/production-stats'
import type { TribeDemographics } from '../game/tribe-stats'
import type { TransformKind } from '../game/entity'
import { formatGameTime } from '../game/game-clock'

export const STATS_PAGE_COUNT = 3

export const STATS_PAGE_TITLES = ['化身者统计', '订单统计', '家族族谱'] as const

export interface StatsOverlayData {
  gameTimeSec: number
  page: number
  scrollY: number
  demographics: TribeDemographics
  familyMarkets: FamilyMarketRecord[]
  genealogies: FamilyGenealogy[]
  orderStats: OrderStatsSummary
}

const LINE_HEIGHT = 18
const PAGE_PAD = 28

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapText(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const chunks: string[] = []
  let current = ''
  for (const ch of text) {
    const next = current + ch
    if (ctx.measureText(next).width > maxWidth && current.length > 0) {
      chunks.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) chunks.push(current)
  return chunks.length > 0 ? chunks : [text]
}

export function getStatsPageContentHeight(
  data: StatsOverlayData,
  page: number,
  contentWidth: number,
  ctx: CanvasRenderingContext2D,
): number {
  ctx.font = '12px system-ui, sans-serif'
  let lines = 2

  if (page === 0) {
    lines += Math.max(1, data.demographics.practitionerByFamily.length)
    lines += 4
  } else if (page === 1) {
    lines += 5
    const orders = listAllOrders(data.familyMarkets)
    for (const order of orders) {
      const fam = data.demographics.families.find((f) => f.familyId === order.familyId)
      const famName = fam?.familyName ?? `家族${order.familyId}`
      const line = `#${order.id} ${famName} · ${ORDER_DEMAND_LABEL[order.kind]} · (${Math.round(order.x)},${Math.round(order.y)})`
      lines += wrapText(line, contentWidth, ctx).length
    }
    if (orders.length === 0) lines += 1
  } else {
    for (const genealogy of data.genealogies) {
      lines += 1 + genealogy.members.length
    }
    if (data.genealogies.length === 0) lines += 1
  }

  return lines * LINE_HEIGHT + PAGE_PAD * 2
}

export function clampStatsScroll(scrollY: number, contentHeight: number, viewportHeight: number): number {
  const maxScroll = Math.max(0, contentHeight - viewportHeight + 40)
  return Math.max(0, Math.min(maxScroll, scrollY))
}

export function drawStatsFullscreenOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: StatsOverlayData,
): void {
  ctx.fillStyle = 'rgba(4, 8, 14, 0.94)'
  ctx.fillRect(0, 0, width, height)

  const margin = Math.max(16, width * 0.04)
  const headerH = 72
  const footerH = 40
  const contentX = margin
  const contentY = headerH
  const contentW = width - margin * 2
  const contentH = height - headerH - footerH

  ctx.textAlign = 'center'
  ctx.fillStyle = '#e8f0ff'
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.fillText('世界统计', width / 2, 36)

  const pageTitle = STATS_PAGE_TITLES[data.page] ?? '统计'
  ctx.fillStyle = '#8aa0c8'
  ctx.font = '14px system-ui, sans-serif'
  ctx.fillText(
    `${pageTitle} · 第 ${data.page + 1}/${STATS_PAGE_COUNT} 页`,
    width / 2,
    58,
  )

  const tabsY = 64
  const tabW = Math.min(110, (contentW - 24) / STATS_PAGE_COUNT)
  for (let i = 0; i < STATS_PAGE_COUNT; i++) {
    const tabX = contentX + i * (tabW + 8)
    const active = i === data.page
    ctx.fillStyle = active ? 'rgba(88, 166, 255, 0.28)' : 'rgba(8, 12, 20, 0.78)'
    roundRect(ctx, tabX, tabsY, tabW, 28, 8)
    ctx.fill()
    ctx.strokeStyle = active ? '#58a6ff' : '#3d4f6e'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = active ? '#ffffff' : '#8aa0c8'
    ctx.font = '12px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(STATS_PAGE_TITLES[i], tabX + tabW / 2, tabsY + 18)
  }

  const scrollY = data.scrollY
  const pageContentH = getStatsPageContentHeight(data, data.page, contentW, ctx)

  ctx.save()
  ctx.beginPath()
  ctx.rect(contentX, contentY, contentW, contentH)
  ctx.clip()

  ctx.textAlign = 'left'
  let cy = contentY + PAGE_PAD - scrollY

  if (data.page === 0) {
    cy = drawLine(ctx, contentX, cy, `模拟时间 ${formatGameTime(data.gameTimeSec)}`, '#b8c4dc')
    cy = drawLine(
      ctx,
      contentX,
      cy,
      `全局活跃化身者 农${data.demographics.practitionerFarm} 校${data.demographics.practitionerSchool} 乐${data.demographics.practitionerPark} 堡${data.demographics.practitionerFortress}`,
    )
    cy += 8
    if (data.demographics.practitionerByFamily.length === 0) {
      cy = drawLine(ctx, contentX, cy, '暂无注册化身者')
    } else {
      for (const fam of data.demographics.practitionerByFamily) {
        const market = data.familyMarkets.find((m) => m.familyId === fam.familyId)
        const funds = market ? ` · 资金 ${Math.floor(market.funds)}` : ''
        cy = drawLine(
          ctx,
          contentX,
          cy,
          `${fam.familyName}${funds} — 农场${fam.farm} 校园${fam.school} 乐园${fam.park} 堡垒${fam.fortress}`,
        )
      }
    }
    cy += 8
    cy = drawLine(
      ctx,
      contentX,
      cy,
      `人口 成年男${data.demographics.adultMale} 女${data.demographics.adultFemale} · 未成年男${data.demographics.juvenileMale} 女${data.demographics.juvenileFemale}`,
      '#7f8ca3',
    )
  } else if (data.page === 1) {
    const os = data.orderStats
    cy = drawLine(
      ctx,
      contentX,
      cy,
      `总计 完成${os.fulfilled} · 进行中${os.active} · 失效${os.incomplete}`,
      '#b8c4dc',
    )
    cy += 6
    const kinds: TransformKind[] = ['farm', 'school', 'park', 'fortress']
    for (const kind of kinds) {
      const stats = os.byKind[kind]
      cy = drawLine(
        ctx,
        contentX,
        cy,
        `${ORDER_DEMAND_LABEL[kind]} 待${stats.open} 进行${stats.assigned} 完成${stats.fulfilled} 失效${stats.expired}`,
      )
    }
    cy += 8
    const orders = listAllOrders(data.familyMarkets)
    if (orders.length === 0) {
      cy = drawLine(ctx, contentX, cy, '暂无订单记录')
    } else {
      for (const order of orders) {
        const fam = data.demographics.families.find((f) => f.familyId === order.familyId)
        const famName = fam?.familyName ?? `家族${order.familyId}`
        const status =
          order.status === 'fulfilled'
            ? '已完成'
            : order.status === 'assigned'
              ? '进行中'
              : order.status === 'open'
                ? '待接单'
                : '已失效'
        const color =
          order.status === 'fulfilled'
            ? '#7ddea8'
            : order.status === 'expired' || order.status === 'cancelled'
              ? '#ff9f9f'
              : '#8aa0c8'
        const remain = Math.max(0, order.deadline - data.gameTimeSec)
        const timeLabel =
          order.status === 'fulfilled'
            ? `完成 ${formatGameTime(order.completedAt ?? data.gameTimeSec)}`
            : `剩余 ${Math.ceil(remain)}s`
        const line = `#${order.id} ${famName} · ${ORDER_DEMAND_LABEL[order.kind]} · ${status} · 地点(${Math.round(order.x)},${Math.round(order.y)}) · ${timeLabel} · 赏${order.reward}`
        for (const chunk of wrapText(line, contentW, ctx)) {
          cy = drawLine(ctx, contentX, cy, chunk, color)
        }
      }
    }
  } else {
    for (const genealogy of data.genealogies) {
      cy = drawLine(
        ctx,
        contentX,
        cy,
        `${genealogy.familyName} — 化身者 农${genealogy.practitionerFarm} 校${genealogy.practitionerSchool} 乐${genealogy.practitionerPark} 堡${genealogy.practitionerFortress}`,
        '#b8c4dc',
      )
      for (const member of genealogy.members) {
        cy = drawLine(ctx, contentX + 12, cy, formatGenealogyLine(member))
      }
      cy += 6
    }
    if (data.genealogies.length === 0) {
      cy = drawLine(ctx, contentX, cy, '暂无家族记录')
    }
  }

  ctx.restore()

  const maxScroll = Math.max(0, pageContentH - contentH + 40)
  if (maxScroll > 0) {
    const trackX = width - margin + 4
    const trackY = contentY + 8
    const trackH = contentH - 16
    const thumbH = Math.max(28, (contentH / pageContentH) * trackH)
    const thumbY = trackY + (scrollY / maxScroll) * (trackH - thumbH)
    ctx.fillStyle = 'rgba(88, 166, 255, 0.18)'
    ctx.fillRect(trackX, trackY, 4, trackH)
    ctx.fillStyle = 'rgba(88, 166, 255, 0.72)'
    ctx.fillRect(trackX, thumbY, 4, thumbH)
  }

  ctx.textAlign = 'center'
  ctx.fillStyle = '#5f6d86'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText('LB/RB 切换页面 · 摇杆/滚轮上下滚动 · Esc/B 关闭', width / 2, height - 14)
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color = '#8aa0c8',
): number {
  ctx.fillStyle = color
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(text, x, y)
  return y + LINE_HEIGHT
}
