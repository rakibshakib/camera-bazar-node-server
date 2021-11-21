const express = require("express");
const app = express();
const admin = require("firebase-admin");
const cors = require("cors");
const port = process.env.PORT || 5000;
const ObjectId = require("mongodb").ObjectId;
const { MongoClient } = require("mongodb");


require("dotenv").config();

// firebase token varificatiion
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// require("./doctors-portal-rs-firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_CLUSER}/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];
    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    // database name
    const cameraApp = client.db("Camera_Bazar");
    // database collections
    const cameraProducts = cameraApp.collection("cameraProducts");
    const userData = cameraApp.collection("user_data");
    const orderedCamera = cameraApp.collection("ordered_camera");
    const reviews = cameraApp.collection("reviews");

    // get all camera product data to ui
    app.get("/cameras", async (req, res) => {
      const cursor = cameraProducts.find({});
      const allCameras = await cursor.toArray();
      res.send(allCameras);
    });

    // add new cameraProduct to database by admin
    app.post("/camera-add", async (req, res) => {
      const camera = req.body;
      const result = await cameraProducts.insertOne(camera);
      res.json(result);
    });
    // delete camera form manage product section
    app.delete("/all-cameras/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await cameraProducts.deleteOne(query);
      res.json(result);
    });

    // add review form user
    app.post("/review", async (req, res) => {
      const userReview = req.body;
      const result = await reviews.insertOne(userReview);
      res.json(result);
    });
    // get review for ui
    app.get("/review", async (req, res) => {
      const cursor = reviews.find({});
      const allReviews = await cursor.toArray();
      res.send(allReviews);
    });

    // add order camera from users
    app.post("/camera-order", async (req, res) => {
      const order = req.body;
      const result = await orderedCamera.insertOne(order);
      res.json(result);
    });

    // get all booking for admin
    app.get("/all-orders", verifyToken, async (req, res) => {
      const cursor = orderedCamera.find({});
      const allOrder = await cursor.toArray();
      res.send(allOrder);
    });

    // post my order for single user by email
    app.post("/my-booking", async (req, res) => {
      try {
        const email = req.body.email;
        const cursor = orderedCamera.find({ email: email });
        const myOrder = await cursor.toArray();
        res.status(200).json(myOrder);
      } catch (error) {
        res.status(404).json({
          message: error.message,
        });
      }
    });
    // get single camera data by id || findOne operation
    app.get("/cameras/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const camera = await cameraProducts.findOne(query);
      res.send(camera);
    });

    // post user data from ui
    app.post("/users-data", async (req, res) => {
      const user = req.body;
      const result = await userData.insertOne(user);
      res.json(result);
    });
    // update data for google login user
    app.put("/users-data", async (req, res) => {
      const user = req.body;
      console.log("google user", user);
      const filterUser = { email: user.email };
      const options = { upsert: true };
      const updateUser = { $set: user };
      const result = await userData.updateOne(filterUser, updateUser, options);
      res.json(result);
    });

    // set admin
    app.put("/users-data/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await userData.findOne({ email: requester });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await userData.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({
            message: "You dont have permission to make this user admin",
          });
      }
    });
    // get user data for verifying if he/she is admin
    app.get("/users-data/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userData.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    // delete one order by user || Delete method
    app.delete("/all-orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderedCamera.deleteOne(query);
      res.json(result);
    });
    // update status data from manageORder
    app.patch("/update-order", async (req, res) => {
      const { _id } = req.body;
      const updateBooking = await orderedCamera.findOneAndUpdate(
        { _id: ObjectId(_id) },
        { $set: { status: "Shipped" } },
        { returnOriginal: false }
      );
      res.status(200).json(updateBooking);
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Deshi Camera App Bazar ✋🏻🙄 !");
});

app.listen(port, () => {
  console.log(` 😍 listening Camera Server at http://localhost:${port}`);
});
