const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
    "application/pdf",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file format. Only JPEG, PNG, WEBP, and PDF files are allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB file limit
  },
  fileFilter: fileFilter,
});

const uploadKYCFields = upload.fields([
  { name: "aadhaar", maxCount: 1 },
  { name: "certificate", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
]);

module.exports = { uploadKYCFields };
