"""Validate repository CSVs and generate a seed SQL file for an empty D1 database."""

import argparse
import csv
import datetime
import re
from collections import Counter
from decimal import Decimal
from pathlib import Path

MODELS = "model_id model_name brand brand_group aliases series generation variant form_factor sale_start_date predecessor_id launch_price chip_vendor chip_model base_ram base_rom source_url notes verification tracking_group".split()
TRACKING = "brand model category date period metric value_wan operator".split()
RANKINGS = "dataset_id source series period_type period period_start period_end top_n actual_count rank model brand_group pixels estimated_units estimated_wan fit_k fit_mode calibration_count accepted_count outlier_threshold algorithm_version saved_at".split()
SHARES = "ISO 周,趋势,苹果,华为,OSTA,小米,OPPO,一加,realme,vivo,iQOO,荣耀".split(",")


def records(root, filename, columns):
    with (root / filename).open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != columns:
            raise ValueError(f"{filename}: unexpected header")
        for row in reader:
            if None in row or None in row.values():
                raise ValueError(f"{filename}:{reader.line_num}: invalid column count")
            yield row


def week(value):
    match = re.fullmatch(r"([0-9]{4})-?W([0-9]{2})", value)
    if not match:
        raise ValueError(f"Invalid ISO week: {value!r}")
    year, number = map(int, match.groups())
    datetime.date.fromisocalendar(year, number, 1)
    return f"{year:04d}-W{number:02d}"


def amount(value):
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", value):
        raise ValueError(f"Invalid nonnegative decimal: {value!r}")
    return Decimal(value)


def literal(value):
    if value is None:
        return "NULL"
    if isinstance(value, int):
        return str(value)
    if "\0" in value:
        raise ValueError("NUL is not supported in CSV values")
    return "'" + value.replace("'", "''") + "'"


def prepare(root):
    statements = []
    keys = set()
    counts = Counter()

    def insert(table, columns, values, key):
        identity = (table, *key)
        if identity in keys:
            raise ValueError(f"Duplicate key: {identity!r}")
        keys.add(identity)
        counts[table] += 1
        statements.append(
            f"INSERT INTO {table} ({', '.join(columns)}) "
            f"VALUES ({', '.join(map(literal, values))});"
        )

    for row in records(root, "model-master.csv", MODELS):
        if not row["model_id"].strip() or not row["model_name"].strip():
            raise ValueError("Machine ID and name are required")
        insert("model_master", MODELS, [row[c] for c in MODELS], (row["model_id"],))

    tracking = {}
    for row in records(root, "sales-long.csv", TRACKING):
        key = (row["brand"], row["model"])
        if not all(value.strip() for value in key):
            raise ValueError(f"Missing tracking identity: {key!r}")
        metadata = (row["category"], row["date"])
        if key not in tracking:
            tracking[key] = (len(tracking) + 1, metadata)
            index = tracking[key][0]
            insert("tracking_models", "tracking_id brand model category date sort_order".split(),
                   [index, *key, *metadata, index - 1], key)
        index, previous = tracking[key]
        if previous != metadata:
            raise ValueError(f"Conflicting tracking metadata: {key!r}")
        period, metric, operator = week(row["period"]), row["metric"], row["operator"]
        operator = {"≥": ">=", "＝": "="}.get(operator, operator)
        if metric not in {"weekly", "cumulative"} or operator not in {"=", ">=", "<", "≈"}:
            raise ValueError(f"Invalid tracking metric or operator: {key!r}, {period}")
        amount(row["value_wan"])
        insert("tracking_sales", "tracking_id period metric value_wan operator".split(),
               [index, period, metric, row["value_wan"], operator], (index, period, metric))

    datasets = {}
    entry_counts = Counter()
    metadata_columns = RANKINGS[:9] + RANKINGS[15:]
    entry_columns = ["dataset_id", *RANKINGS[9:15]]
    for row in records(root, "sales-estimates.csv", RANKINGS):
        key = row["dataset_id"]
        if not key.strip() or not row["model"].strip():
            raise ValueError("Ranking dataset ID and model are required")
        metadata = [row[c] for c in metadata_columns]
        if row["period_type"] == "weekly":
            week(row["period"])
        if key not in datasets:
            datasets[key] = metadata
            values = [
                int(row[c]) if c in {"top_n", "actual_count", "calibration_count", "accepted_count"}
                and row[c] != "" else row[c] or None for c in metadata_columns
            ]
            if int(row["top_n"]) <= 0 or int(row["actual_count"]) <= 0:
                raise ValueError(f"Invalid ranking size: {key!r}")
            insert("ranking_datasets", metadata_columns, values, (key,))
        elif datasets[key] != metadata:
            raise ValueError(f"Conflicting ranking metadata: {key!r}")
        rank = int(row["rank"])
        if rank <= 0:
            raise ValueError(f"Invalid rank: {key!r}, {rank}")
        if amount(row["estimated_units"]) != amount(row["estimated_wan"]) * 10000:
            raise ValueError(f"Inconsistent ranking estimates: {key!r}, rank {rank}")
        insert("ranking_entries", entry_columns, [key, rank, *[row[c] for c in entry_columns[2:]]],
               (key, rank))
        entry_counts[key] += 1

    for key, metadata in datasets.items():
        if entry_counts[key] != int(metadata[metadata_columns.index("actual_count")]):
            raise ValueError(f"Ranking row count mismatch: {key!r}")

    for row in records(root, "market-share.csv", SHARES):
        period = week(row[SHARES[0]])
        shares = [row[c] or None for c in SHARES[2:]]
        if any(amount(v) > 100 for v in shares if v is not None):
            raise ValueError(f"Market share exceeds 100: {period}")
        cols = "period trend apple huawei osta xiaomi oppo oneplus realme vivo iqoo honor".split()
        insert("market_share_weekly", cols, [period, row[SHARES[1]], *shares], (period,))

    expected = {"model_master", "tracking_models", "tracking_sales", "ranking_datasets",
                "ranking_entries", "market_share_weekly"}
    if expected - counts.keys():
        raise ValueError(f"Empty input tables: {sorted(expected - counts.keys())}")
    return statements, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=Path("."))
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        statements, counts = prepare(args.source)
        with args.output.open("x", encoding="utf-8") as output:
            output.write("-- Initial seed for an empty database\n" + "\n".join(statements) + "\n")
    except (ValueError, OSError, csv.Error) as error:
        parser.exit(1, f"{error}\n")
    for table, count in counts.items():
        print(f"{table}: {count}")


if __name__ == "__main__":
    main()
