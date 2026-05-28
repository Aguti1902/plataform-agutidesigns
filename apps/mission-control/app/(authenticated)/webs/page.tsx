export default function WebsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-zinc-900">Webs</h1>
      <p className="text-sm text-zinc-500">
        Listado y estado QA de las webs desplegadas. Se rellena cuando el agente{' '}
        <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs">web-builder</code> entregue su
        primer despliegue.
      </p>
    </div>
  );
}
