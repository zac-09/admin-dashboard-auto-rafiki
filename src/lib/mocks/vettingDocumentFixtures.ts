import type { VettingDocType, VettingDocument } from '@/types';

import { FIXTURE_NOW } from './contractFixtures';

const hoursAgo = (h: number) => new Date(FIXTURE_NOW.getTime() - h * 3_600_000).toISOString();

/** A 1×1 PNG, enough for an <img> to render in mock mode. */
export const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
/** A minimal PDF, enough for an <iframe>. */
export const TINY_PDF_DATA_URL =
  'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+';

/**
 * Ssempala (pending, boda) uploaded two of his three documents; the riding permit is missing.
 * Namukasa (verified) has both of hers. Everyone else has uploaded nothing.
 */
export const VETTING_DOCUMENTS: Record<string, Partial<Record<VettingDocType, VettingDocument>>> = {
  u_mech_ssempala: {
    'national-id': {
      docType: 'national-id',
      storagePath: 'vetting/u_mech_ssempala/national-id/8f1c2a',
      contentType: 'image/jpeg',
      sizeBytes: 412_300,
      uploadedAt: hoursAgo(20),
      version: 1,
    },
    certification: {
      docType: 'certification',
      storagePath: 'vetting/u_mech_ssempala/certification/0d9e77',
      contentType: 'application/pdf',
      sizeBytes: 1_280_000,
      uploadedAt: hoursAgo(19),
      version: 2,
    },
  },
  u_mech_namukasa: {
    'national-id': {
      docType: 'national-id',
      storagePath: 'vetting/u_mech_namukasa/national-id/aa31b0',
      contentType: 'image/png',
      sizeBytes: 650_000,
      uploadedAt: hoursAgo(24 * 40),
      version: 1,
    },
    certification: {
      docType: 'certification',
      storagePath: 'vetting/u_mech_namukasa/certification/c04d12',
      contentType: 'image/jpeg',
      sizeBytes: 380_000,
      uploadedAt: hoursAgo(24 * 40),
      version: 1,
    },
  },
};
