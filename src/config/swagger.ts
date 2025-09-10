import swaggerJsdoc from "swagger-jsdoc";
import { Application } from "express";
import swaggerUi from "swagger-ui-express";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "TrataTech Smart Contract API",
      version: "1.0.0",
      description:
        "API for interacting with TrataTech smart contracts on Polygon network",
      contact: {
        name: "TrataTech Support",
        email: "support@tratatech.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
          description: "API key for authentication",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              example: "Error message",
            },
            message: {
              type: "string",
              example: "Detailed error description",
            },
          },
        },
        Success: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
            },
            message: {
              type: "string",
              example: "Operation successful",
            },
          },
        },
        CreateEventRequest: {
          type: "object",
          required: [
            "eventName",
            "eventDescription",
            "eventDate",
            "maxAttendees",
          ],
          properties: {
            eventName: {
              type: "string",
              example: "TrataTech Product Launch",
              maxLength: 256,
            },
            eventDescription: {
              type: "string",
              example: "Exclusive product launch event for TrataTech community",
              maxLength: 1000,
            },
            eventDate: {
              type: "integer",
              example: 1735689600,
              description: "Unix timestamp",
            },
            maxAttendees: {
              type: "integer",
              example: 100,
              minimum: 1,
              maximum: 10000,
            },
            ipfsData: {
              type: "object",
              description: "Additional event data to store on IPFS",
            },
          },
        },
        CreateProductLaunchRequest: {
          type: "object",
          required: [
            "productName",
            "productDescription",
            "launchDate",
            "maxSupply",
          ],
          properties: {
            productName: {
              type: "string",
              example: "TrataTech Premium NFT",
              maxLength: 256,
            },
            productDescription: {
              type: "string",
              example: "Premium NFT collection for TrataTech community",
              maxLength: 1000,
            },
            launchDate: {
              type: "integer",
              example: 1735689600,
              description: "Unix timestamp",
            },
            maxSupply: {
              type: "integer",
              example: 1000,
              minimum: 1,
              maximum: 100000,
            },
            price: {
              type: "string",
              example: "1000000000000000000",
              description: "Price in wei",
            },
            ipfsData: {
              type: "object",
              description: "Additional product data to store on IPFS",
            },
          },
        },
        BlockchainTransaction: {
          type: "object",
          properties: {
            transactionHash: {
              type: "string",
              example: "0x1234567890abcdef...",
            },
            blockNumber: {
              type: "integer",
              example: 12345678,
            },
            gasUsed: {
              type: "string",
              example: "21000",
            },
            status: {
              type: "string",
              example: "success",
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to the API files
};

const specs = swaggerJsdoc(options);

export const initializeSwagger = (app: Application): void => {
  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "TrataTech API Documentation",
    })
  );

  // Serve the OpenAPI JSON
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(specs);
  });
};
