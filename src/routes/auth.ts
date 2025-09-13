import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

// Import types
import { ApiKeyRequest, ApiKeyResponse, ApiResponse } from '../types';
import { generateApiKey, validateApiKey, revokeApiKey } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ApiKeyRequest:
 *       type: object
 *       required:
 *         - walletAddress
 *       properties:
 *         walletAddress:
 *           type: string
 *           description: User's wallet address
 *         role:
 *           type: string
 *           description: User role (optional, defaults to 'user')
 *     ApiKeyResponse:
 *       type: object
 *       properties:
 *         apiKey:
 *           type: string
 *           description: Generated API key
 *         user:
 *           type: object
 *           properties:
 *             walletAddress:
 *               type: string
 *             role:
 *               type: string
 */

/**
 * @swagger
 * /api/v1/auth/generate-api-key:
 *   post:
 *     summary: Generate a new API key for a wallet address
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApiKeyRequest'
 *     responses:
 *       200:
 *         description: API key generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/ApiKeyResponse'
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Server error
 */
router.post('/generate-api-key', [
  body('walletAddress').isEthereumAddress().withMessage('Valid Ethereum address is required'),
  body('role').optional().isIn(['user', 'admin', 'operator']).withMessage('Valid role is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      };
      res.status(400).json(response);
      return;
    }

    const { walletAddress, role = 'user' }: ApiKeyRequest & { role?: string } = req.body;

    // Generate API key
    const apiKey = generateApiKey(walletAddress, role);

    const response: ApiResponse<ApiKeyResponse> = {
      success: true,
      message: 'API key generated successfully',
      data: {
        apiKey,
        user: {
          walletAddress,
          role
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('API key generation error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Failed to generate API key'
    };
    res.status(500).json(response);
  }
});

/**
 * @swagger
 * /api/v1/auth/validate-api-key:
 *   post:
 *     summary: Validate an API key
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: API key to validate
 *     responses:
 *       200:
 *         description: API key is valid
 *       401:
 *         description: Invalid API key
 *       500:
 *         description: Server error
 */
router.post('/validate-api-key', [
  body('apiKey').notEmpty().withMessage('API key is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      };
      res.status(400).json(response);
      return;
    }

    const { apiKey }: { apiKey: string } = req.body;

    // Validate API key
    const user = validateApiKey(apiKey);

    if (!user) {
      const response: ApiResponse = {
        success: false,
        message: 'Invalid API key'
      };
      res.status(401).json(response);
      return;
    }

    const response: ApiResponse<{ user: { walletAddress: string; role: string } }> = {
      success: true,
      message: 'API key is valid',
      data: {
        user: {
          walletAddress: user.walletAddress,
          role: user.role
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('API key validation error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Failed to validate API key'
    };
    res.status(500).json(response);
  }
});

/**
 * @swagger
 * /api/v1/auth/revoke-api-key:
 *   post:
 *     summary: Revoke an API key
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: API key to revoke
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *       401:
 *         description: Invalid API key
 *       500:
 *         description: Server error
 */
router.post('/revoke-api-key', [
  body('apiKey').notEmpty().withMessage('API key is required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: ApiResponse = {
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      };
      res.status(400).json(response);
      return;
    }

    const { apiKey }: { apiKey: string } = req.body;

    // Revoke API key
    const revoked = revokeApiKey(apiKey);

    if (!revoked) {
      const response: ApiResponse = {
        success: false,
        message: 'API key not found'
      };
      res.status(401).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      message: 'API key revoked successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('API key revocation error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Failed to revoke API key'
    };
    res.status(500).json(response);
  }
});

/**
 * @swagger
 * /api/v1/auth/list-api-keys:
 *   get:
 *     summary: List all API keys (admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API keys listed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin access required
 *       500:
 *         description: Server error
 */
router.get('/list-api-keys', async (_req: Request, res: Response) => {
  try {
    // This would typically require admin authentication
    // For now, we'll return a mock response
    const response: ApiResponse<{ apiKeys: Array<{ walletAddress: string; role: string; apiKey: string }> }> = {
      success: true,
      message: 'API keys listed successfully',
      data: {
        apiKeys: [
          {
            walletAddress: '0x1234567890123456789012345678901234567890',
            role: 'admin',
            apiKey: 'admin-api-key-123'
          },
          {
            walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            role: 'user',
            apiKey: 'user-api-key-456'
          },
          {
            walletAddress: '0x9876543210987654321098765432109876543210',
            role: 'operator',
            apiKey: 'operator-api-key-789'
          }
        ]
      }
    };

    res.json(response);
  } catch (error) {
    console.error('List API keys error:', error);
    const response: ApiResponse = {
      success: false,
      message: 'Failed to list API keys'
    };
    res.status(500).json(response);
  }
});

export default router;
