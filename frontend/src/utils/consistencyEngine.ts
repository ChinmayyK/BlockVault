import { RedactEntity, RedactionGroup } from "../types/redactor";

export function buildTermIndex(entities: RedactEntity[]): { 
  entities: RedactEntity[]; 
  groups: Record<string, RedactionGroup> 
} {
  const normMap = new Map<string, { term: string, entityType: string, indices: number[] }>();

  // Optional: you can filter out very short terms or specific types if needed
  entities.forEach((ent, idx) => {
    // Only group named entities or specific regex matches (excluding purely manual boxes with no text)
    if (ent.text && ent.entity_type !== "MANUAL" && ent.text.length > 2) {
      // Normalize term for grouping (case-insensitive, trimmed)
      const norm = ent.text.trim().toLowerCase();
      
      const existing = normMap.get(norm);
      if (existing) {
        existing.indices.push(idx);
      } else {
        normMap.set(norm, { term: ent.text.trim(), entityType: ent.entity_type, indices: [idx] });
      }
    }
  });

  const updatedEntities = [...entities];
  const groups: Record<string, RedactionGroup> = {};

  normMap.forEach(({ term, entityType, indices }) => {
    if (indices.length > 1) { // Only create groups for repeated terms
      const groupId = `group-${crypto.randomUUID()}`;
      groups[groupId] = {
        id: groupId,
        term,
        count: indices.length,
        entityType
      };

      indices.forEach(idx => {
        updatedEntities[idx] = { ...updatedEntities[idx], group_id: groupId };
      });
    }
  });

  return { entities: updatedEntities, groups };
}
