// Select chart type
var mapChart = dc.geoChoroplethChart("#mapChart");
var fatalTypeChart = dc.pieChart("#fatal-type-chart");
var quarterChart = dc.pieChart("#quarter-chart");
var weekChart = dc.rowChart("#week-chart");
var stackChart = dc.lineChart("#stack-chart");
var barChart = dc.barChart("#bar-chart");

// Load Data from csv file
d3.csv("data/full.csv", function(csv) {

    //**********************************************//
    //                     data                     //
    //**********************************************//

    // Create format
    var dateFormat = d3.time.format("%m/%d/%Y");
    var numberFormat = d3.format(".0f");

    // Pre-process data
    csv.forEach(function(d) {
        d.dd = dateFormat.parse(d.eventDate);
        d.month = d3.time.month(d.dd);
        d.injuryNum = d3.sum([d["fatalNum"], d["seriousNum"], d["minorNum"], d["uninjuredNum"]]);
    });

    //**********************************************//
    //                  dimensions                  //
    //**********************************************//

    // Create cossfilter dimensions & groups
    var data = crossfilter(csv),
        all = data.groupAll();

    // Create Yearly Dimension
    var yearlyDimension = data.dimension(function(d) {
        return d3.time.year(d.dd).getFullYear();
    });

    // Create Full Date Dimension
    var dateDimension = data.dimension(function(d) {
        return d.dd;
    });

    // Create Month Dimension
    var injuryMonths = data.dimension(function(d) {
        return d.month;
    });

    // Create fatal type dimension
    var fatalType = data.dimension(function(d) {
        return d["fatalNum"] > 0 ? "Fatal" : "Non-Fatal";
    });

    // Create quarter dimension
    var quarter = data.dimension(function(d) {
        var month = d.dd.getMonth();
        if (month <= 2)
            return "Q1";
        else if (month > 3 && month <= 5)
            return "Q2";
        else if (month > 5 && month <= 8)
            return "Q3";
        else
            return "Q4";
    });

    // Create week dimension
    var week = data.dimension(function(d) {
        var day = d.dd.getDay();
        var name = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        return day + "." + name[day];
    });

    // Create states dimension
    var states = data.dimension(function(d) {
        return d["state"];
    });

    //**********************************************//
    //                    groups                    //
    //**********************************************//

    // Group by total injury number within month
    var monthlyInjuryGroup = injuryMonths.group().reduceSum(function(d) {
        return d.InjuryNum;
    });

    // Group by different types of injury
    var injuryTypeMonthGroup = injuryMonths.group().reduce(
        function(p, v) {
            p.date = dateFormat(v.dd);
            p.fatalNum += parseInt(v.fatalNum);
            p.seriousNum += parseInt(v.seriousNum);
            p.minorNum += parseInt(v.minorNum);
            p.uninjuredNum += parseInt(v.uninjuredNum);
            return p;
        },
        function(p, v) {
            p.date = dateFormat(v.dd);
            p.fatalNum -= parseInt(v.fatalNum);
            p.seriousNum -= parseInt(v.seriousNum);
            p.minorNum -= parseInt(v.minorNum);
            p.uninjuredNum -= parseInt(v.uninjuredNum);
            return p;
        },
        function() {
            return {
                fatalNum: 0,
                seriousNum: 0,
                minorNum: 0,
                uninjuredNum: 0
            };
        }
    );

    // Group by total injury within month
    var barMonthGroup = injuryMonths.group().reduceSum(function(d) {
        return d.injuryNum;
    });

    // Group by fatal type
    var fatalTypeGroup = fatalType.group();

    // Group by quarter
    var quarterGroup = quarter.group().reduceSum(function(d) {
        return d.injuryNum;
    });

    // Group by week
    var weekGroup = week.group();

    // Group by States
    var statesInjurySum = states.group().reduceSum(function(d) {
        return d.injuryNum;
    });

    //**********************************************//
    //                    charts                    //
    //**********************************************//

    d3.json("data/us-states.json", function(statesJson) {

        // map chart
        mapChart
            .width(990)
            .height(500)
            .dimension(states)
            .group(statesInjurySum)
            .colors(d3.scale.quantize().range(["#E2F2FF", "#C4E4FF", "#9ED2FF", "#81C5FF", "#6BBAFF", "#51AEFF", "#36A2FF", "#1E96FF", "#0089FF", "#0061B5"]))
            .colorDomain([0, csv.length / 10])
            .colorCalculator(function(d) { return d ? mapChart.colors()(d) : '#ccc'; })
            .overlayGeoJson(statesJson.features, "state", function(d) { return d.properties.name; })
            .title(function(d) { return "State: " + d.key + "\nTotal Injury Number: " + numberFormat(d.value ? d.value : 0); });

        // stack area chart
        stackChart
            .renderArea(true)
            .width(990)
            .height(300)
            .transitionDuration(1000)
            .margins({
                top: 30,
                right: 50,
                bottom: 25,
                left: 40
            })
            .dimension(injuryMonths)
            .mouseZoomable(true)
            .rangeChart(barChart)
                .x(d3.time.scale().domain([new Date(1973, 1, 1), new Date(2015, 1, 1)]))
                .round(d3.time.month.round)
                .xUnits(d3.time.months)
                .elasticY(true)
                .renderHorizontalGridLines(true)
                .legend(dc.legend().x(800).y(10).itemHeight(13).gap(5))
                .brushOn(false)
                // Create group & stack layers
                .group(injuryTypeMonthGroup, "Fatal")
                    .valueAccessor(function(d) { return d.value.fatalNum; })
                    .stack(injuryTypeMonthGroup, "Serious", function(d) { return d.value.seriousNum; })
                    .stack(injuryTypeMonthGroup, "Minor", function(d) { return d.value.minorNum; })
                    .stack(injuryTypeMonthGroup, "Uninjured", function(d) { return d.value.uninjuredNum; })
                    .ordinalColors(['#3182bd', '#6baed6', '#9ecae1', '#c6dbef'])
                    // Add tooltip to the stack area chart
                    .title(function(d) {
                        d.value.total = d.value.fatalNum + d.value.seriousNum + d.value.minorNum + d.value.uninjuredNum;
                        return d.value.date + "\n" +
                            "total: " + numberFormat(d.value.total) + "\n" +
                            "fatal: " + numberFormat(d.value.fatalNum) + "\n" +
                            "serious: " + numberFormat(d.value.seriousNum) + "\n" +
                            "minor: " + numberFormat(d.value.minorNum) + "\n" +
                            "uninjured: " + numberFormat(d.value.uninjuredNum);
                    });

        // bar chart
        barChart
            .width(990)
            .height(110)
            .margins({
                top: 0,
                right: 50,
                bottom: 20,
                left: 40
            })
            .dimension(injuryMonths)
            .group(barMonthGroup)
            .centerBar(true)
            .gap(1)
            .x(d3.time.scale().domain([new Date(1973, 1, 1), new Date(2015, 1, 1)]))
            .round(d3.time.month.round)
            .alwaysUseRounding(true)
            .xUnits(d3.time.months);

        // week bar chart
        weekChart
            .width(200)
            .height(200)
            .margins({
                top: 20,
                left: 10,
                right: 10,
                bottom: 20
            })
            .group(weekGroup)
            .dimension(week)
            .ordinalColors(['#3182bd', '#6baed6', '#9ecae1', '#c6dbef', '#dadaeb'])
            .label(function(d) { return d.key.split(".")[1]; })
            .title(function(d) { return d.injuryNum; })
            .elasticX(true)
            .xAxis().ticks(4);

        // quarter donut chart
        quarterChart
            .width(200)
            .height(200)
            .radius(90)
            .innerRadius(40)
            .dimension(quarter)
            .group(quarterGroup);

        // fatal type pie chart
        fatalTypeChart
            .width(200)
            .height(200)
            .radius(90)
            .dimension(fatalType)
            .group(fatalTypeGroup)
            .label(function(d) {
            if (fatalTypeChart.hasFilter() && !fatalTypeChart.hasFilter(d.key))
                return d.key + "(0%)";
                return d.key + "(" + Math.floor(d.value / all.value() * 100) + "%)";
            });

        // render all the charts
        dc.renderAll();

    });

    //**********************************************//
    //                    tables                    //
    //**********************************************//

    // data count
    dc.dataCount(".dc-data-count")
        .dimension(data)
        .group(all);

    // datatable
    var dynatable = $('.dc-data-table').dynatable({
        features: {
            pushState: false
        },
        dataset: {
            records: dateDimension.top(Infinity),
            perPageDefault: 20,
            perPageOptions: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]
        }
    }).data('dynatable');

    // Refresh table helper function
    function RefreshTable() {
        dc.events.trigger(function () {
            dynatable.settings.dataset.originalRecords = dateDimension.top(Infinity);
            dynatable.process();
        });
    };

    // Refresh when filtered by charts
    for (var i = 0; i < dc.chartRegistry.list().length; i++) {
        var chartI = dc.chartRegistry.list()[i];
        chartI.on("filtered", RefreshTable);
    }

});