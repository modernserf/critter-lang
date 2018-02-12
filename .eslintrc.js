module.exports = {
    "extends": "standard",
    "plugins": ["jest"],
    "rules" : {
        "indent": ["error", 4],
        "comma-dangle": ["error", "always-multiline"]
    },
    "env": {
        "jest/globals": true
    }
};
