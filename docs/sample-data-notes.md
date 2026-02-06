# Sample Data — Test Cases

The file `data/sample.ged` contains 7 individuals and 4 families designed to exercise
the ingestion pipeline, including both clean data and intentional conflicts.

## Clean Records

| ID   | Name             | Birth         | Death         | Notes                        |
|------|------------------|---------------|---------------|------------------------------|
| @I1@ | John Smith       | 15 MAR 1820   | 22 NOV 1885   | Exact dates, clean locations |
| @I2@ | Mary Johnson     | ABT 1825      | 3 FEB 1890    | Estimated birth date         |
| @I3@ | James Smith      | 10 JUN 1848   | 1910          | Year-only death, immigration |
| @I4@ | Elizabeth Brown   | 20 SEP 1852   | AFT 1920      | "After" death date           |
| @I5@ | William Smith    | 4 JUL 1876    | 12 APR 1918   | Death + burial (WWI France)  |
| @I6@ | Sarah Smith      | MAR 1880      | (none)        | Month-only birth, no death   |

## Intentional Conflicts (Person @I7@ — Thomas Bad_Data)

| Conflict                   | Detail                                              |
|----------------------------|-----------------------------------------------------|
| Death before birth         | Born 1900, first death record is 1890               |
| Multiple death events      | Two DEAT records (1890 and 1960)                    |
| Marriage without divorce   | Two MARR events (1920 and 1935) with no DIV record  |

This person is designed to trigger at least 3 conflict detection rules.

## Family Structure

```
John Smith ── m. 1845 ── Mary Johnson
      │
      └── James Smith ── m. 1875 ── Elizabeth Brown
                │
                ├── William Smith (d. 1918, France)
                └── Sarah Smith
```
