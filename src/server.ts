import handler from '@tanstack/react-start/server-entry'

export default {
  async fetch(request: Request) {
    return handler.fetch(request, {})
  },
}
