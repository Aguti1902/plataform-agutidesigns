import type { Database } from './types';

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type Marca = Enums['marca'];
export type LeadStatus = Enums['lead_status'];
export type WebStatus = Enums['web_status'];
export type PlanTipo = Enums['plan_tipo'];
export type FacturaStatus = Enums['factura_status'];
export type AgentStatus = Enums['agent_status'];
export type EventType = Enums['event_type'];

export type Lead = Tables['leads']['Row'];
export type Cliente = Tables['clientes']['Row'];
export type Web = Tables['webs']['Row'];
export type Presupuesto = Tables['presupuestos']['Row'];
export type Factura = Tables['facturas']['Row'];
export type Event = Tables['events']['Row'];
export type AgentRun = Tables['agent_runs']['Row'];
export type AgentConfig = Tables['agent_config']['Row'];
export type Conversation = Tables['conversations']['Row'];
export type Nicho = Tables['nichos']['Row'];
