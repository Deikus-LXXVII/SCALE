# scale_memora_curator quirks

- Candidate acceptance by Memora is runtime acknowledgement only; it is not
  SCALE validation or Git promotion.
- The role remains native Sol/high with a read-only workspace because all
  writes are candidate-only through the Memora capability boundary.
