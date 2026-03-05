---
type: taxonomy
tag: [zara/taxonomy]
---

# Zara Taxonomy (Tags + Folders)

We use **both**:
- **Folders** for durable organization + scanability
- **Tags** for cross-cutting retrieval + graphs

## Folder layout
- `agents/zara/10 - Axioms/`
- `agents/zara/20 - Heuristics/`
- `agents/zara/30 - References/`
- `agents/zara/40 - Signals/`
- `agents/zara/50 - Critiques/`
- `agents/zara/60 - MOCs/`
- `agents/zara/99 - Templates/`

## Tag set (canonical)
Use these as the *minimum* tags in frontmatter.

### Node type tags
- `#zara/axiom`
- `#zara/heuristic`
- `#zara/reference`
- `#zara/signal`
- `#zara/critique`
- `#zara/moc`
- `#zara/pov`

### Optional facet tags (add as needed)
- Craft facets: `#zara/typography` `#zara/color` `#zara/layout` `#zara/motion` `#zara/photography` `#zara/sound` `#zara/copy` `#zara/3d` `#zara/ui`
- Emotional register: `#zara/warm` `#zara/cold` `#zara/playful` `#zara/severe` `#zara/luxury` `#zara/gritty`
- Context: `#zara/brand` `#zara/product` `#zara/editorial` `#zara/social`

## Linking rules
Every node should answer:
- What is it?
- Why does it matter?
- What does it connect to? (minimum 2 links)

### Required backlinks
- Every `Critique` links to the `Heuristics` it used.
- Any repeated critique outcome → update a heuristic.
- Any heuristic that survives multiple projects → consider promoting to an axiom.

## Naming conventions
- `Axiom — …`
- `Heuristic — …`
- `Reference — …`
- `Signal — …`
- `Critique — <Project> — YYYY-MM-DD`
- `MOC — …`
