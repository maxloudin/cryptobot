"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfToPng = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const const_1 = require("./const");
const node_canvas_factory_1 = require("./node.canvas.factory");
const props_to_pdf_doc_init_params_1 = require("./props.to.pdf.doc.init.params");
function pdfToPng(pdfFilePathOrBuffer, props) {
    return __awaiter(this, void 0, void 0, function* () {
        const pdf = yield import('pdfjs-dist/legacy/build/pdf.mjs');
        const isBuffer = Buffer.isBuffer(pdfFilePathOrBuffer);
        const pdfFileBuffer = isBuffer
            ? pdfFilePathOrBuffer
            : yield node_fs_1.promises.readFile(pdfFilePathOrBuffer);
        const pdfDocInitParams = (0, props_to_pdf_doc_init_params_1.propsToPdfDocInitParams)(props);
        pdfDocInitParams.data = new Uint8Array(pdfFileBuffer);
        const canvasFactory = new node_canvas_factory_1.NodeCanvasFactory();
        pdfDocInitParams.canvasFactory = canvasFactory;
        const pdfDocument = yield pdf.getDocument(pdfDocInitParams).promise;
        const targetedPageNumbers = (props === null || props === void 0 ? void 0 : props.pagesToProcess) !== undefined
            ? props.pagesToProcess
            : Array.from({ length: pdfDocument.numPages }, (_, index) => index + 1);
        if ((props === null || props === void 0 ? void 0 : props.strictPagesToProcess) && targetedPageNumbers.some((pageNum) => pageNum < 1)) {
            throw new Error('Invalid pages requested, page number must be >= 1');
        }
        if ((props === null || props === void 0 ? void 0 : props.strictPagesToProcess) && targetedPageNumbers.some((pageNum) => pageNum > pdfDocument.numPages)) {
            throw new Error('Invalid pages requested, page number must be <= total pages');
        }
        if (props === null || props === void 0 ? void 0 : props.outputFolder) {
            yield node_fs_1.promises.mkdir(props.outputFolder, { recursive: true });
        }
        let pageName;
        if (props === null || props === void 0 ? void 0 : props.outputFileMask) {
            pageName = props.outputFileMask;
        }
        if (!pageName && !isBuffer) {
            pageName = (0, node_path_1.parse)(pdfFilePathOrBuffer).name;
        }
        if (!pageName) {
            pageName = const_1.PDF_TO_PNG_OPTIONS_DEFAULTS.outputFileMask;
        }
        const pngPagesOutput = [];
        for (const pageNumber of targetedPageNumbers) {
            if (pageNumber > pdfDocument.numPages || pageNumber < 1) {
                continue;
            }
            const page = yield pdfDocument.getPage(pageNumber);
            const viewport = page.getViewport({
                scale: (props === null || props === void 0 ? void 0 : props.viewportScale) !== undefined
                    ? props.viewportScale
                    : const_1.PDF_TO_PNG_OPTIONS_DEFAULTS.viewportScale,
            });
            const canvasAndContext = canvasFactory.create(viewport.width, viewport.height);
            const renderContext = {
                canvasContext: canvasAndContext.context,
                viewport,
            };
            yield page.render(renderContext).promise;
            const pngPageOutput = {
                pageNumber,
                name: `${pageName}_page_${pageNumber}.png`,
                content: canvasAndContext.canvas.toBuffer(),
                path: '',
                width: viewport.width,
                height: viewport.height,
            };
            canvasFactory.destroy(canvasAndContext);
            page.cleanup();
            if (props === null || props === void 0 ? void 0 : props.outputFolder) {
                pngPageOutput.path = (0, node_path_1.resolve)(props.outputFolder, pngPageOutput.name);
                yield node_fs_1.promises.writeFile(pngPageOutput.path, pngPageOutput.content);
            }
            pngPagesOutput.push(pngPageOutput);
        }
        yield pdfDocument.cleanup();
        return pngPagesOutput;
    });
}
exports.pdfToPng = pdfToPng;
//# sourceMappingURL=pdf.to.png.js.map