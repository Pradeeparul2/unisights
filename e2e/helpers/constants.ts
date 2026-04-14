const frameworks = [
  { name: "express", port: 3001 },
  { name: "fastapi", port: 3002 },
  { name: "flask", port: 3003 },
  { name: "fastify", port: 3004 },
  { name: "nestjs", port: 3005 },
];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export { frameworks, UUID_REGEX };
