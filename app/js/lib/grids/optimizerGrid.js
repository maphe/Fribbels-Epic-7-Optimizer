const tinygradient = require('tinygradient');
var gradient = tinygradient('#ffa8a8', '#ffffe5', '#8fed78');

var optimizerGrid; 
var currentSortModel;
var currentAggregate = {};

module.exports = {

    initialize: () => {
        buildGrid();
    },

    refresh: (getResultRowsResponse) => {
        // gridOptions
        console.log("REFRESH")
        optimizerGrid.gridOptions.api.setDatasource(datasource);
        // optimizerGrid.gridOptions.api.refreshInfiniteCache();
        optimizerGrid.gridOptions.api.paginationGoToPage(0);
    },

    setPinnedHero: (hero) => {
        optimizerGrid.gridOptions.api.setPinnedTopRowData([hero]);
    },

    showLoadingOverlay: () => {
        optimizerGrid.gridOptions.api.showLoadingOverlay();
    },

    getSelectedGearIds: () => {
        const selectedRows = optimizerGrid.gridOptions.api.getSelectedRows();
        if (selectedRows.length > 0) {
            const row = selectedRows[0];
            console.log("SELECTED ROW", row)

            return [
                row.items[0], 
                row.items[1], 
                row.items[2], 
                row.items[3], 
                row.items[4], 
                row.items[5]
            ];
        }
        return [];
    },
}

const datasource = {
    async getRows(params) {
        console.log("DEBUG getRows params", params);
        const startRow = params.startRow;
        const endRow = params.endRow;
        const sortColumn = params.sortModel.length ? params.sortModel[0].colId : null;
        const sortOrder = params.sortModel.length ? params.sortModel[0].sort : null;

        global.optimizerGrid = optimizerGrid;

        optimizerGrid.gridOptions.api.showLoadingOverlay();
        const optimizationRequest = OptimizerTab.getOptimizationRequestParams();

        const request = {
            startRow: startRow, 
            endRow: endRow, 
            sortColumn: sortColumn, 
            sortOrder: sortOrder,
            optimizationRequest: optimizationRequest
        }

        const getResultRowsResponse = Api.getResultRows(request).then(getResultRowsResponse => {
            console.log("GetResultRowsResponse", getResultRowsResponse);
            aggregateCurrentHeroStats(getResultRowsResponse.heroStats)
            optimizerGrid.gridOptions.api.hideOverlay();
            params.successCallback(getResultRowsResponse.heroStats, getResultRowsResponse.maximum)

            var pinned = optimizerGrid.gridOptions.api.getPinnedTopRow(0);
            if (pinned) {
                optimizerGrid.gridOptions.api.setPinnedTopRowData([pinned.data])
            }
        });
    },
}

function aggregateCurrentHeroStats(heroStats) {
// currentAggregate
    const statsToAggregate = [
        "atk",
        "hp",
        "def",
        "spd",
        "cr",
        "cd",
        "eff",
        "res",
        "dac",
        "cp",
        "hpps",
        "ehp",
        "ehpps",
        "dmg",
        "dmgps",
        "mcdmg",
        "mcdmgps"
    ]

    var count = heroStats.length;

    for (var stat of statsToAggregate) {
        const arrSum = arr => arr.reduce((a,b) => a + b[stat], 0);
        var max = Math.max(...getField(heroStats, stat));
        var min = Math.min(...getField(heroStats, stat));
        var sum = arrSum(heroStats);
        var avg = sum/count;

        if (stat == 'cr') {
            max = Math.min(100, max);
            min = Math.min(100, min);
        }
        if (stat == 'cd') {
            max = Math.min(350, max);
            min = Math.min(350, min);
        }

        currentAggregate[stat] = {
            max: cleanInfinities(max),
            min: cleanInfinities(min),
            sum: cleanInfinities(sum),
            avg: cleanInfinities(avg)
        }
    }

    console.log("Aggregated", currentAggregate);
}

function cleanInfinities(num) {
    if (num == -Infinity || num == Infinity) {
        return 0;
    }
    return num;
}

function getField(heroStats, stat) {
    return heroStats.map(x => x[stat]);
}

function buildGrid() {

    const gridOptions = {
        defaultColDef: {
            width: 45,
            sortable: true,
            sortingOrder: ['desc', 'asc'],
            cellStyle: columnGradient,
            suppressNavigable: true,
            cellClass: 'no-border'
            // valueFormatter: numberFormatter,
        },

        columnDefs: [
            {headerName: 'sets', field: 'sets', width: 100, cellRenderer: (params) => renderSets(params.value)},
            {headerName: 'atk', field: 'atk'},
            {headerName: 'hp', field: 'hp', width: 70},
            {headerName: 'def', field: 'def'},
            {headerName: 'spd', field: 'spd'},
            {headerName: 'cr', field: 'cr'},
            {headerName: 'cd', field: 'cd'},
            {headerName: 'eff', field: 'eff'},
            {headerName: 'res', field: 'res'},
            // {headerName: 'dac', field: 'dac'},
            {headerName: 'cp', field: 'cp'},
            {headerName: 'hp*s', field: 'hpps', width: 65},
            {headerName: 'ehp', field: 'ehp', width: 65},
            {headerName: 'ehp*s', field: 'ehpps', width: 65},
            {headerName: 'dmg', field: 'dmg'},
            {headerName: 'dmg*s', field: 'dmgps', width: 65},
            {headerName: 'mcdmg', field: 'mcdmg', width: 65},
            {headerName: 'mcdmg*s', field: 'mcdmgps', width: 65},
        ],
        rowHeight: 27,
        rowModelType: 'infinite',
        rowSelection: 'single',
        onRowSelected: onRowSelected,
        pagination: true,
        paginationPageSize: 1000,
        cacheBlockSize: 1000,
        maxBlocksInCache: 1,
        suppressPaginationPanel: false,
        datasource: datasource,
    };

    const gridDiv = document.getElementById('myGrid');
    optimizerGrid = new Grid(gridDiv, gridOptions);
    console.log("Built optimizergrid", optimizerGrid);
}

function columnGradient(params) {
    try {
        if (!params || params.value == undefined) return;
        var colId = params.column.colId;
        var value = params.value;

        var agg = currentAggregate[colId];
        if (!agg) return;

        var percent = (value - agg.min) / (agg.max - agg.min + 1);
        percent = Math.min(1, Math.max(0, percent))

        console.log("AGG", agg, percent)

        var color = gradient.rgbAt(percent);
        if (agg.min == 0 && agg.max == 0) {
            color = gradient.rgbAt(0.5)
        } 


        return {
            backgroundColor: color.toHexString()
        };
    } catch (e) {console.error(e)}

}

function onRowSelected(event) {
    const gearIds = module.exports.getSelectedGearIds();
    OptimizerTab.drawPreview(gearIds);
}

// Figure out what set images to show on the grid
function renderSets(setCounters) {
    // console.log("RENDERSETS", setCounters)
    if (!setCounters)
        return;

    const sets = [];
    for (var i = 0; i < setCounters.length; i++) {
        const setsFound = Math.floor(setCounters[i] / Constants.piecesBySetIndex[i]);
        for (var j = 0; j < setsFound; j++) {
            sets.push(Constants.setsByIndex[i]);
        }
    }

    const images = sets.map(x => '<img class="optimizerSetIcon" src=' + Assets.getSetAsset(x) + '></img>');
    // console.log("RenderSets images", images);
    return images.join("");
}