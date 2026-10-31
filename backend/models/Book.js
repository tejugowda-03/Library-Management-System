const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: { type: String, required: true },
    author: { type: String, required: true },
    isbn: { type: String, required: true, unique: true },
    category: { type: String, required: true },
    totalCopies: { type: Number, default: 1 },
    availableCopies: { type: Number, default: 1 },
    description: { type: String, default: '' },
    price: { type: Number, default: 99 },
    pdfPath: { type: String, default: null },
    previewPath: { type: String, default: null },
    hasPreview: { type: Boolean, default: false },
    hasFullPdf: { type: Boolean, default: false },
    coverImage: { type: String, default: '' },
    publisher: { type: String, default: '' },
    publishedYear: { type: Number },
    pages: { type: Number },
    downloadCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);