from __future__ import annotations

import argparse
import json
import tempfile
from pathlib import Path
from typing import Any

from backend.guardian import GuardianStore


def run_benchmark(runs: int = 5) -> dict[str, Any]:
    if runs < 1 or runs > 1000:
        raise ValueError("runs must be between 1 and 1000")

    observations: list[dict[str, Any]] = []
    with tempfile.TemporaryDirectory(prefix="guardian-review-benchmark-") as directory:
        for index in range(runs):
            store = GuardianStore(Path(directory) / f"run-{index}.sqlite3", seed_demo=True)
            store.change_fact("owner", "sponsor.amount", 100_000)

            proposal = store.create_action(
                "catering-agent",
                "reserve_budget",
                {"amount": 50_000, "category": "optional-upgrade"},
            )
            review_on = store.evaluate_review()
            review_off = {
                "status": "DISABLED",
                "findings": [],
                "budget": review_on["budget"],
            }

            over_cap = store.create_action(
                "catering-agent",
                "reserve_budget",
                {"amount": 100_001, "category": "hard-cap-negative-control"},
            )
            gate_result = store.claim_action("catering-agent", over_cap["id"], 1)

            observations.append({
                "run": index + 1,
                "review_on": {
                    "status": review_on["status"],
                    "finding_codes": [finding["code"] for finding in review_on["findings"]],
                    "shortfall": review_on["budget"]["shortfall"],
                },
                "review_off": {
                    "status": review_off["status"],
                    "finding_codes": [],
                    "shortfall": review_off["budget"]["shortfall"],
                },
                "hard_gate": {
                    "outcome": gate_result.get("outcome"),
                    "code": gate_result.get("code"),
                    "proposal_id": proposal["id"],
                },
            })

    return {
        "benchmark": "deterministic-review-on-off-fixture",
        "runs": runs,
        "interpretation": (
            "This is a deterministic regression comparison, not an LLM-quality or latency benchmark. "
            "Review OFF suppresses advice only; the same gateway remains active."
        ),
        "summary": {
            "review_on_warning_runs": sum(
                "BUDGET_SHORTFALL_WARN" in item["review_on"]["finding_codes"]
                for item in observations
            ),
            "review_off_warning_runs": sum(bool(item["review_off"]["finding_codes"]) for item in observations),
            "hard_gate_denial_runs": sum(item["hard_gate"]["outcome"] == "DENY" for item in observations),
            "hard_gate_codes": sorted({item["hard_gate"]["code"] for item in observations}),
        },
        "observations": observations,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare deterministic reviewer ON/OFF against the same hard gateway.")
    parser.add_argument("--runs", type=int, default=5)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = run_benchmark(args.runs)
    rendered = json.dumps(result, indent=2, sort_keys=True)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    else:
        print(rendered)


if __name__ == "__main__":
    main()
