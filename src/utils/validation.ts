import { ethers } from "ethers";

export class ValidationUtils {
  /**
   * Validate Ethereum address
   */
  static validateAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Validate IPFS CID
   */
  static validateIPFSCID(cid: string): boolean {
    // Basic CID validation
    if (!cid || typeof cid !== "string") {
      return false;
    }

    // Check length (CIDv0: 46 chars, CIDv1: 59+ chars)
    if (cid.length < 46 || cid.length > 90) {
      return false;
    }

    // Check for valid prefixes
    if (cid.startsWith("Qm") || cid.startsWith("bafy")) {
      return true;
    }

    return false;
  }

  /**
   * Validate string length
   */
  static validateStringLength(
    str: string,
    min: number = 1,
    max: number = 256
  ): boolean {
    if (!str || typeof str !== "string") {
      return false;
    }
    return str.length >= min && str.length <= max;
  }

  /**
   * Validate array size
   */
  static validateArraySize(
    arr: any[],
    min: number = 0,
    max: number = 100
  ): boolean {
    if (!Array.isArray(arr)) {
      return false;
    }
    return arr.length >= min && arr.length <= max;
  }

  /**
   * Validate numeric range
   */
  static validateNumericRange(
    value: number,
    min: number,
    max: number
  ): boolean {
    if (typeof value !== "number" || isNaN(value)) {
      return false;
    }
    return value >= min && value <= max;
  }

  /**
   * Validate timestamp (not in future)
   */
  static validateTimestamp(timestamp: number): boolean {
    if (typeof timestamp !== "number" || isNaN(timestamp)) {
      return false;
    }
    return timestamp <= Date.now() / 1000;
  }

  /**
   * Validate future timestamp
   */
  static validateFutureTimestamp(timestamp: number): boolean {
    if (typeof timestamp !== "number" || isNaN(timestamp)) {
      return false;
    }
    return timestamp > Date.now() / 1000;
  }

  /**
   * Validate date range
   */
  static validateDateRange(startDate: number, endDate: number): boolean {
    if (
      !this.validateTimestamp(startDate) ||
      !this.validateTimestamp(endDate)
    ) {
      return false;
    }
    return endDate > startDate;
  }

  /**
   * Validate percentage (0-100)
   */
  static validatePercentage(percentage: number): boolean {
    return this.validateNumericRange(percentage, 0, 100);
  }

  /**
   * Validate basis points (0-10000)
   */
  static validateBasisPoints(basisPoints: number): boolean {
    return this.validateNumericRange(basisPoints, 0, 10000);
  }

  /**
   * Validate ETH amount (in wei)
   */
  static validateETHAmount(amount: string): boolean {
    try {
      const parsed = ethers.parseEther(amount);
      return parsed > 0n;
    } catch {
      return false;
    }
  }

  /**
   * Validate JSON object
   */
  static validateJSONObject(obj: any): boolean {
    try {
      return typeof obj === "object" && obj !== null && !Array.isArray(obj);
    } catch {
      return false;
    }
  }

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    if (typeof input !== "string") {
      return "";
    }

    return input
      .trim()
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate merkle proof
   */
  static validateMerkleProof(proof: string[]): boolean {
    if (!Array.isArray(proof)) {
      return false;
    }

    return proof.every(
      (item) =>
        typeof item === "string" && item.length === 66 && item.startsWith("0x")
    );
  }

  /**
   * Validate signature components
   */
  static validateSignatureComponents(r: string, s: string, v: number): boolean {
    return (
      typeof r === "string" &&
      r.length === 66 &&
      r.startsWith("0x") &&
      typeof s === "string" &&
      s.length === 66 &&
      s.startsWith("0x") &&
      typeof v === "number" &&
      (v === 27 || v === 28)
    );
  }

  /**
   * Validate function signature
   */
  static validateFunctionSignature(signature: string): boolean {
    if (typeof signature !== "string") {
      return false;
    }

    // Basic hex validation
    return /^0x[a-fA-F0-9]+$/.test(signature) && signature.length >= 10;
  }

  /**
   * Validate brand ID format
   */
  static validateBrandId(brandId: string): boolean {
    if (!this.validateStringLength(brandId, 1, 50)) {
      return false;
    }

    // Allow alphanumeric, hyphens, underscores
    return /^[a-zA-Z0-9_-]+$/.test(brandId);
  }

  /**
   * Validate serial number format
   */
  static validateSerialNumber(serialNumber: string): boolean {
    if (!this.validateStringLength(serialNumber, 1, 100)) {
      return false;
    }

    // Allow alphanumeric, hyphens, underscores, dots
    return /^[a-zA-Z0-9._-]+$/.test(serialNumber);
  }

  /**
   * Validate country code
   */
  static validateCountryCode(countryCode: string): boolean {
    if (!this.validateStringLength(countryCode, 2, 3)) {
      return false;
    }

    // ISO country codes (2 or 3 letters)
    return /^[A-Z]{2,3}$/.test(countryCode);
  }

  /**
   * Validate certificate number
   */
  static validateCertificateNumber(certNumber: string): boolean {
    if (!this.validateStringLength(certNumber, 1, 100)) {
      return false;
    }

    // Allow alphanumeric, hyphens, underscores, slashes
    return /^[a-zA-Z0-9._/-]+$/.test(certNumber);
  }
}
