STUD_MAPS = {
    // rgb: {
    //     name: "RGB",
    //     officialName: "RGB Example",
    //     sortedStuds: ["#ff6666", "#66ff66", "#6666ff"],
    //     studMap: {
    //         "#ff6666": 1000,
    //         "#66ff66": 1000,
    //         "#6666ff": 1000
    //     }
    // },
    warhol_marilyn_monroe: {
        name: "Warhol (31197)",
        officialName: "Andy Warhol's Marilyn Monroe (31197)",
        sortedStuds: [
            "#212121",
            "#595d60",
            "#42c0fb",
            "#f7d117",
            "#ffbbff",
            "#c87080",
            "#b52952"
        ],
        studMap: {
            "#212121": 629,
            "#595d60": 131,
            "#42c0fb": 587,
            "#f7d117": 587,
            "#ffbbff": 587,
            "#c87080": 587,
            "#b52952": 46
        }
    },
    the_beatles: {
        name: "The Beatles (31198)",
        officialName: "The Beatles (31198)",
        sortedStuds: [
            "#212121",
            "#595d60",
            "#afb5c7",
            "#ffffff",
            "#143044",
            "#5a7184",
            "#9fc3e9",
            "#ff7e14",
            "#f7ba30",
            "#dec69c",
            "#907450",
            "#e3a05b",
            "#b35408",
            "#89351d",
            "#330000"
        ],
        studMap: {
            "#212121": 698,
            "#595d60": 141,
            "#afb5c7": 51,
            "#ffffff": 149,
            "#143044": 121,
            "#5a7184": 52,
            "#9fc3e9": 57,
            "#ff7e14": 74,
            "#f7ba30": 65,
            "#dec69c": 283,
            "#907450": 137,
            "#e3a05b": 29,
            "#b35408": 85,
            "#89351d": 250,
            "#330000": 554
        }
    },
    iron_man: {
        name: "Iron Man (31199)",
        officialName: "Marvel Studios Iron Man (31199)",
        sortedStuds: [
            "#212121",
            "#595d60",
            "#afb5c7",
            "#5a7184",
            "#143044",
            "#ffffff",
            "#e79500",
            "#dec69c",
            "#907450",
            "#e3a05b",
            "#b35408",
            "#b30006",
            "#6a0e15",
            "#89351d",
            "#330000"
        ],
        studMap: {
            "#212121": 476,
            "#595d60": 91,
            "#afb5c7": 31,
            "#5a7184": 23,
            "#143044": 529,
            "#ffffff": 61,
            "#e79500": 232,
            "#dec69c": 155,
            "#907450": 97,
            "#e3a05b": 208,
            "#b35408": 162,
            "#b30006": 308,
            "#6a0e15": 214,
            "#89351d": 191,
            "#330000": 196
        }
    },
    star_wars_sith: {
        name: "Star Wars (31200)",
        officialName: "Star Wars The Sith (31200)",
        sortedStuds: [
            "#212121",
            "#666660",
            "#595d60",
            "#afb5c7",
            "#5a7184",
            "#143044",
            "#ffffff",
            "#f3e055",
            "#ff7e14",
            "#b30006",
            "#6a0e15",
            "#330000"
        ],
        studMap: {
            "#212121": 877,
            "#666660": 271,
            "#595d60": 151,
            "#afb5c7": 110,
            "#5a7184": 139,
            "#143044": 447,
            "#ffffff": 187,
            "#f3e055": 92,
            "#ff7e14": 125,
            "#b30006": 286,
            "#6a0e15": 328,
            "#330000": 100
        }
    }
};

const availableStudHexes = BRICKLINK_STUD_COLORS.map(color => color.hex);
const studHexToCount = {};
availableStudHexes.forEach(hex => {
    studHexToCount[hex] = 99999;
});
STUD_MAPS["all_stud_colors"] = {
    name: "All Stud Colors",
    officialName: "All Available Stud Colors",
    sortedStuds: availableStudHexes,
    studMap: studHexToCount
};

const availableTileHexes = BRICKLINK_TILE_COLORS.map(color => color.hex);
const tileHexToCount = {};
availableTileHexes.forEach(hex => {
    tileHexToCount[hex] = 99999;
});
STUD_MAPS["all_tile_colors"] = {
    name: "All Tile Colors",
    officialName: "All Available Tile Colors",
    sortedStuds: availableTileHexes,
    studMap: tileHexToCount
};


const availablePickABrickStudHexes = [
    '#ff7e14',
    '#0057a6',
    '#afb5c7',
    '#595d60',
    '#ffffff',
    '#a6ca55',
    '#10cb31',
    '#f7d117',
    '#b30006',
    '#5f2683',
    '#89351d',
    '#dec69c',
    '#ffbbff'
];
const pickABricStudkHexToCount = {};
availablePickABrickStudHexes.forEach(hex => {
    pickABricStudkHexToCount[hex] = 99999;
});
STUD_MAPS["pick_a_brick"] = {
    name: "Pick a Brick",
    officialName: "Lego.com Pick a Brick",
    sortedStuds: availablePickABrickStudHexes,
    studMap: pickABricStudkHexToCount
};