# Hermes token policy

This reference is intentionally short and is loaded only when routing needs
explicit budget decisions.

- direct route first;
- no child for one atomic low-risk mutation;
- no more than two independent leaf children by default;
- no nested delegation for routine work;
- exact files and acceptance checks in every work order;
- one batched final validation pass;
- one repair cycle maximum;
- no repeated passing checks;
- no whole-library or whole-repository context loads;
- no automatic external-provider escalation;
- preserve prompt caching and old conversation context.

If quality and cost conflict, spend extra tokens only when the risk is security,
public contracts, data migration, irreversible state, or an explicit user
request for deeper analysis.
