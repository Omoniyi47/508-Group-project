import swaggerJSDoc from 'swagger-jsdoc';

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Transcript Digitization & Result Retrieval System API',
    version: '1.0.0',
    description:
      'Interactive reference for the core Auth, Students, Results, and Transcripts flows.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
      Student: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          matricNumber: { type: 'string', example: 'CSC/2023/001' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          department: { type: 'string', description: 'Department ObjectId' },
          entrySession: { type: 'string', description: 'Session ObjectId' },
          currentLevel: { type: 'string', description: 'Level ObjectId' },
          status: { type: 'string', enum: ['active', 'graduated', 'withdrawn', 'suspended'] },
        },
      },
      Result: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          student: { type: 'string' },
          course: { type: 'string' },
          session: { type: 'string' },
          semester: { type: 'string' },
          level: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 100 },
          grade: { type: 'string', example: 'A' },
          gradePoint: { type: 'number', example: 5 },
          status: { type: 'string', enum: ['draft', 'submitted', 'approved', 'rejected'] },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

export const swaggerSpec = swaggerJSDoc({
  definition,
  apis: ['./src/routes/authRoutes.js', './src/routes/studentRoutes.js', './src/routes/resultRoutes.js', './src/routes/transcriptRoutes.js'],
});
