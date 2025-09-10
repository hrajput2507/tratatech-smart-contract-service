/**
 * Helper functions for IPFS data handling
 */

export interface NormalizedIPFSMetadata {
  name: string;
  description: string;
  image?: string;
  attributes?: Array<{
    trait_type: string;
    value: string | number;
  }>;
  external_url?: string;
  animation_url?: string;
  [key: string]: any; // Allow additional properties
}

/**
 * Normalizes IPFS metadata to ensure required fields are present
 */
export function normalizeIPFSMetadata(
  ipfsData: any,
  fallbackName: string,
  fallbackDescription: string
): NormalizedIPFSMetadata {
  return {
    name: ipfsData.name || fallbackName,
    description: ipfsData.description || fallbackDescription,
    image: ipfsData.image,
    attributes: ipfsData.attributes,
    external_url: ipfsData.external_url,
    animation_url: ipfsData.animation_url,
    ...ipfsData, // Include all other properties
  };
}
