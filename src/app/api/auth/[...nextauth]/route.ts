import { handlers } from "@/auth";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const { GET, POST } = handlers;
