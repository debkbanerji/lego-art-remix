const TS_ROUND_GRANULARITY = 1000;

try {
    if (window.location.href.match("metric")) {
        perfLoggingDatabase = firebase.database();
        perfLoggingDatabase
            .ref("/input-image-count/per-day")
            .once("value")
            .then((snapshot) => {
                document.getElementById("metrics-card").hidden = false;
                const val = snapshot.val();
                if (val != null) {
                    const mergedTSMap = {};
                    Object.keys(val).forEach((rawTS) => {
                        const roundedTS = Math.round(rawTS / TS_ROUND_GRANULARITY) * TS_ROUND_GRANULARITY;
                        mergedTSMap[roundedTS] = (mergedTSMap[roundedTS] || 0) + Number(val[rawTS]);
                    });
                    const dataPoints = Object.keys(mergedTSMap).map((ts) => {
                        return { ts: ts, count: mergedTSMap[ts] };
                    });
                    dataPoints.sort((d1, d2) => d2.ts - d1.ts);
                    dataPoints.forEach((point) => {
                        const row = document.createElement("tr");
                        const cell1 = document.createElement("td");
                        cell1.innerHTML = new Date(
                            point.ts * 1000
                            // use year.month.day.
                        ).toLocaleDateString("ko-KR");
                        const cell2 = document.createElement("td");
                        cell2.innerHTML = point.count;
                        row.appendChild(cell1);
                        row.appendChild(cell2);
                        document.getElementById("input-image-count-table").appendChild(row);
                    });
                }
            });
    }
} catch (_e) {
    // we don't care if this fails
}
