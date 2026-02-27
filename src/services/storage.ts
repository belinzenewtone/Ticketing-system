/**
 * File storage service.
 * TODO: Configure a storage provider (e.g. AWS S3, Cloudflare R2, Vercel Blob)
 * and implement uploadTicketAttachment here.
 */
export async function uploadTicketAttachment(_file: File): Promise<string> {
    throw new Error('File storage is not configured. Please set up a storage provider.');
}
