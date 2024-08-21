"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propsToPdfDocInitParams = void 0;
const const_1 = require("./const");
const verbosity_level_1 = require("./types/verbosity.level");
function propsToPdfDocInitParams(props) {
    const pdfDocInitParams = Object.assign({}, const_1.DOCUMENT_INIT_PARAMS_DEFAULTS);
    pdfDocInitParams.verbosity = (props === null || props === void 0 ? void 0 : props.verbosityLevel) !== undefined ? props === null || props === void 0 ? void 0 : props.verbosityLevel : verbosity_level_1.VerbosityLevel.ERRORS;
    pdfDocInitParams.disableFontFace =
        (props === null || props === void 0 ? void 0 : props.disableFontFace) !== undefined ? props.disableFontFace : const_1.PDF_TO_PNG_OPTIONS_DEFAULTS.disableFontFace;
    pdfDocInitParams.useSystemFonts =
        (props === null || props === void 0 ? void 0 : props.useSystemFonts) !== undefined ? props.useSystemFonts : const_1.PDF_TO_PNG_OPTIONS_DEFAULTS.useSystemFonts;
    pdfDocInitParams.enableXfa =
        (props === null || props === void 0 ? void 0 : props.enableXfa) !== undefined ? props.enableXfa : const_1.PDF_TO_PNG_OPTIONS_DEFAULTS.enableXfa;
    pdfDocInitParams.password =
        (props === null || props === void 0 ? void 0 : props.pdfFilePassword) !== undefined ? props === null || props === void 0 ? void 0 : props.pdfFilePassword : const_1.PDF_TO_PNG_OPTIONS_DEFAULTS.pdfFilePassword;
    return pdfDocInitParams;
}
exports.propsToPdfDocInitParams = propsToPdfDocInitParams;
//# sourceMappingURL=props.to.pdf.doc.init.params.js.map