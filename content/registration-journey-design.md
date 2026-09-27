# Registration journey

Approved three-stage visual direction: child details outside the gate; family details approaching the gate; a welcome scene inside the gate after a confirmed save.

The front-end keeps existing field names and the `/api/interest` request contract. No schema or database API changes. UI verification intercepts requests and never writes to the database. Scenes use cross-fade and gentle zoom transitions, rather than a rendered video. Reduced-motion preference and a manual control disable the transitions.

Asset: `dist/assets/registration-journey-atlas.png`, produced with the built-in image-generation tool using the approved storyboard as reference.

Final asset prompt: One 3:1 production photographic atlas of three equal square, full-bleed scenes. The same two Indian schoolchildren viewed from behind in white uniforms and forest-green backpacks, at the same Stone Field cream concrete gateway with shield pillar, rust perforated column, fountain, modern school and Rehan hills. Left: outside closed gates. Middle: approaching partly open gates. Right: walking inside fully open gates toward the fountain, warm gold light on the paving. Cinematic natural photography matching the approved storyboard. No UI, labels, margins or text overlays.

Deploy updated `build.mjs`, `src/register.html`, `src/app.js`, `src/journey.css`, `src/journey.js`, and the new atlas asset; rebuild to refresh `dist`. No database setup command is needed for this visual update.
