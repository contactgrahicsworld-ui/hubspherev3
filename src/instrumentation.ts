export default async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapProviders } = await import('@/lib/providers/provider-bootstrap');
    await bootstrapProviders();
  }
}
