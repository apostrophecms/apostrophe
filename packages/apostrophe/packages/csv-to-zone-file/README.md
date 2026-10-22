Produces a zone file suitable for import into Amazon Route 53. If your goal is
to actually use it in a standalone DNS server, you'll want to add
an SOA (Start Of Authority) record to the output manually.

Run:

```
npm install -g csv-to-zone-file
csv-to-zone-file < myfile.csv > myfile.zone
```

The CSV file must have columns as shown in this example:

|  Type  | Host   | Value   |
| ------ | ------ | ------- |
| A      | www    | a.b.c.d |

`Type` may be `A`, `CNAME`, etc. The suffix ` Record` is stripped from `Type` if present.

`TTL` is an optional column. If not present the TTL is 1 hour.

If `MX` records are present there must be a `Priority` column as well.
