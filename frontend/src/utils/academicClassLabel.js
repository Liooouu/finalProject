export function academicClassLabel(program, yearLevel, section) {
  const yearAndSection = `${yearLevel}${section || ""}`;
  return program ? `${program} ${yearAndSection}` : `Year ${yearAndSection}`;
}
