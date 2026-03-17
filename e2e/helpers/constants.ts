const frameworks = [
  { name: "express", port: 3001 },
  { name: "fastapi", port: 3002 },
];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export { frameworks, UUID_REGEX };
