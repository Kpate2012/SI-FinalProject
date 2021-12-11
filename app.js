const express = require("express");
const app = express();
const multer = require("multer");
const axios = require("axios");
const path = require("path");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config({ path: "./test.env" });
let port = 3000;

//middlewares
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cors());
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

//swagger playground configuration
const options = {
  swaggerDefinition: {
    info: {
      title:
        "Analyze, describe and Tag images using Computer Vision API - Azure",
      version: "1.0.0",
      description: "ITIS-6177 System Integration Project API",
    },
    host: "localhost:3000",
    basePath: "/",
  },
  apis: ["app.js"],
};

const specs = swaggerJsdoc(options);
app.use("/docs", swaggerUi.serve, swaggerUi.setup(specs));

// multer storage engine
const imageStorage = multer.diskStorage({
  destination: "./upload/images",
  filename: (req, file, cb) => {
    return cb(null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

//upload configuration
app.use("/uploadImage", express.static("upload/images"));
const upload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 4000000,
  },
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname);
    if (
      ext !== ".png" &&
      ext !== ".gif" &&
      ext !== ".jpeg" &&
      ext !== ".jpg" &&
      ext !== ".bmp"
    ) {
      return cb(new multer.MulterError("You can use JPEG, PNG, BMP, GIF formats only!"));
    }
    cb(null, true);
  },
});

app.get("/", (req, res) => {
  res.send("Try API Endpoints using Postman!!!");
});

let azureApiEndpoint = process.env.ENDPOINT_URL;
let subscriptionKey = process.env.SUBSCRIPTION_KEY;
let type = upload.single("file");

/**
 * @swagger
 * /api/v1/analyzeImage:
 *   post:
 *     tags:
 *     - "Analyze Image"
 *     summary: API will take image url or file uploaded image and provide categories based on query parameters
 *     consumes:
 *       - application/json
 *       - multipart/form-data
 *     parameters:
 *       - in: query
 *         name: details
 *         description: Choose any details category to analyze image with more accurate details
 *         type: string
 *         enum:
 *         - "celebrities"
 *         - "landmarks"
 *       - in: formData
 *         name: Upload image
 *         type: file
 *         description: Choose the image of format JPEG, JPG, PNG, GIF, BMP extensions)
 *       - in: body
 *         name: Image URL
 *         description: Provide URL of image to analyzed (Either URL or file upload is allowd)
 *         schema:
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *     responses:
 *        '200':
 *          description: OK
 *        '400':
 *          description: Input validation Failed
 *        '500':
 *          description: Internal server error
 */
app.post("/api/v1/analyzeImage", type, (req, res) => {
  try {
    let requestBody = req.body;
    const details = req.query.details;
    if (!subscriptionKey) {
      throw new Error("Make sure you have set endpoint and key properly");
    }
    //create api url and add query params
    var uri = azureApiEndpoint + "/vision/v3.2/analyze";
    if (details) {
      uri = uri + "?details=" + details;
    }
    //Choose the type of file
    let imgUrl;
    if (requestBody.url && req.file) {
      res
        .status(400)
        .send("File upload and URL both are not allowed together!");
    } else if (requestBody.url) {
      imgUrl = requestBody.url + "";
    } else if (req.file) {
      imgUrl = `http://localhost:3000/uploadImage/${req.file.filename}`;
    } else {
      return res.status(400).json({
        success: false,
        code: "IncorrectRequestParameters",
        message: "Bad Request. Incorrect request parameter/headers sent.",
      });
    }
    let options = {
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    };
    let data = {
      'url': imgUrl,
    };

    
  axios.post(uri, data, options).then(function (response) {
        let analysis = response.data.categories[0];
        return res.status(200).json({
          success: true,
          categories: analysis,
        });
      })
      .catch(function (error) {
        return res.status(500).json({
          success: false,
          code: error.code,
          // code:"code1",
          message: "Internal Server Error",
        });
      });
  
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: "APIissue",
      message: "Internal Server Error",
    });
  }
});

/**
 * @swagger
 * /api/v1/describeImage:
 *   post:
 *     tags:
 *     - "Describe Image"
 *     summary: API will take image url or file uploaded image and provide description of the image
 *     consumes:
 *       - application/json
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: Upload image
 *         type: file
 *         description: Choose the image of format JPEG, JPG, PNG, GIF, BMP extensions)
 *       - in: body
 *         name: Image URL
 *         description: provide URL of image to get the description
 *         schema:
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *     responses:
 *        '200':
 *          description: OK
 *        '400':
 *          description: Input validation Failed
 *        '500':
 *          description: Internal server error
 */
app.post("/api/v1/describeImage", upload.single("image"), (req, res) => {
  try {
    let requestUrl = req.body.url;
    if (!subscriptionKey) {
      throw new Error(
        "Set your environment variables for your subscription key and endpoint."
      );
    }

    //create api url and add query params
    var uri = azureApiEndpoint + "/vision/v3.2/describe";

    //Choose the type of file
    let imgUrl;
    if (requestUrl && req.file) {
      res
        .status(400)
        .send("File upload and URL both are not allowed together!");
    } else if (requestUrl) {
      imgUrl = requestUrl + "";
    } else if (req.file) {
      imgUrl = `http://localhost:3000/uploadImage/${req.file.filename}`;
    } else {
      return res.status(400).json({
        success: false,
        code: "IncorrectRequestparameters",
        message: "Bad Request. Incorrect request parameter/headers sent.",
      });
    }

    let options = {
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    };
    let data = {
      url: imgUrl,
    };

    // send url/file to Azure API
    axios
      .post(uri, data, options)
      .then(function (response) {
        let description = response.data.description;
        return res.status(200).json({
          success: true,
          descriptions: description,
        });
      })
      .catch(function (error) {
        return res.status(500).json({
          success: false,
          code: error.code,
          message: "Internal Server Error",
        });
      });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: "APIissue",
      message: "Internal Server Error",
    });
  }
});

/**
 * @swagger
 * /api/v1/tagImage:
 *   post:
 *     tags:
 *     - "Tag Image"
 *     summary: API will take image url or file uploaded image and provide tags in specified language based on query parameters
 *     consumes:
 *       - application/json
 *       - multipart/form-data
 *     parameters:
 *       - in: query
 *         name: language
 *         description: Choose any language from the list and response will be displayed in that language
 *         type: string
 *         enum:
 *         - "en"
 *         - "es"
 *         - "hi"
 *         - "it"
 *         - "fr"
 *       - in: formData
 *         name: Upload image
 *         type: file
 *         description: Choose the image of format JPEG, JPG, PNG, GIF, BMP extensions)
 *       - in: body
 *         name: Image URL
 *         description: provide URL of image to get the tags
 *         schema:
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *     responses:
 *        '200':
 *          description: OK
 *        '400':
 *          description: Input validation Failed
 *        '500':
 *          description: Internal server error
 */
app.post("/api/v1/tagImage", upload.single("image"), (req, res) => {
  try {
    let requestUrl = req.body.url;
    const language = req.query.language;

    if (!subscriptionKey) {
      throw new Error(
        "Set your environment variables for your subscription key and endpoint."
      );
    }

    //create api url and add query params
    var uri = azureApiEndpoint + "/vision/v3.2/tag";

    //create api url and add query params
    if (language) {
      uri = uri + "?language=" + language;
    }
    //Choose the type of file
    let imgUrl;
    if (requestUrl && req.file) {
      res
        .status(400)
        .send("File upload and URL both are not allowed together!");
    } else if (requestUrl) {
      imgUrl = requestUrl + "";
    } else if (req.file) {
      imgUrl = `http://localhost:3000/uploadImage/${req.file.filename}`;
    } else {
      return res.status(400).json({
        success: false,
        code: "IncorrectRequestParameters",
        message: "Bad Request. Incorrect request parameter/headers sent.",
      });
    }

    let options = {
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": subscriptionKey,
      },
    };
    let data = {
      url: imgUrl,
    };

    // send url/file to Azure API
    axios
      .post(uri, data, options)
      .then(function (response) {
        let tag = response.data.tags;
        return res.status(200).json({
          success: true,
          tags: tag,
        });
      })
      .catch(function (error) {
        return res.status(500).json({
          success: false,
          code: error.code,
          message: "Internal Server Error",
        });
      });
  } catch (error) {
    return res.status(500).json({
      success: false,
      code: "APIissue",
      message: "Internal Server Error",
    });
  }
});

function errorHandler(err, req, res) {
  if (err instanceof multer.MulterError) {

    return res.status(400).send({
      success: false,
      code: err.code,
      message: "Incorrect request params/headers",
    });
  } else {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
}

app.use(errorHandler);

app.listen(port, () => {
  console.log("Server running on:", port);
});
