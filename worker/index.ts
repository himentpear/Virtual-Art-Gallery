export { GalleryRoomDO } from './GalleryRoomDO'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/health') {
      return Response.json({
        ok: true,
        service: 'octopath-pixel-hall',
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      })
    }

    if (url.pathname.startsWith('/ws/room')) {
      const roomId = url.searchParams.get('room') || 'main-hall-1'
      const stub = env.GALLERY_ROOM.getByName(roomId)
      return stub.fetch(request)
    }

    if (url.pathname === '/api/room/stats') {
      const roomId = url.searchParams.get('room') || 'main-hall-1'
      const stub = env.GALLERY_ROOM.getByName(roomId)
      const stats = await stub.getStats()
      return Response.json({
        roomId,
        onlineCount: stats.onlineCount,
        players: stats.players,
      })
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
