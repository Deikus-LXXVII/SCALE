# scale_memora_curator quirks

- Candidate acceptance by Memora is runtime acknowledgement only; it is not
  SCALE validation or Git promotion.
- The role remains native Sol/high with a read-only workspace because all
  writes are candidate-only through the Memora capability boundary.
- Memora 0.3.3 compatibility: normal read-only `memory_get` calls must use
  `follow=latest`; upstream rejects `follow=active`. Search and digest calls
  may retain active-follow semantics.

Provenance: source="pinned Memora 0.3.3 compatibility observation";
evidence="upstream memory_get rejects follow=active while latest succeeds";
compatibility="SCALE >= 0.1.8 with Memora 0.3.3"; validated_on="2026-08-16";
review_after="2026-11-16".
