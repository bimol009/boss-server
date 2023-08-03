const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const app = express();
const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// meddleware

app.use(cors());
app.use(express.json());

// let transporter = nodemailer.createTransport({
//   host: 'smtp.sendgrid.net',
//   port: 587,
//   auth: {
//       user: "apikey",
//       pass: process.env.SENDGRID_API_KEY
//   }
// })

const auth = {
  auth: {
    api_key: process.env.EMAIL_PRIVATE_KEY,
    domain: process.env.MAILGUN_DOMAIN,
  },
};

const transporter = nodemailer.createTransport(mg(auth));

const sendPaymentConfirmationEmail = (payment) => {
  transporter.sendMail(
    {
      from: "sarkerbimol24@gmail.com", // verified sender email
      to: "sarkerbimol24@gmail.com", // recipient email
      subject: "Your order is confirmed ,", // Subject line
      text: "Hello world!", // plain text body
      html: `<h2>Payment Confirm</h2>
    transactionId: ${payment.transactionId}
    `, // html body
    },
    function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    }
  );
};

app.get("/", (req, res) => {
  res.send("Boss Is running");
});

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: "unAthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unAthorized access" });
    }
    req.decoded = decoded;

    next();
  });
};

const uri = `mongodb+srv://${process.env.BOSS_USER}:${process.env.BOSS_PASS}@cluster0.jcb1rgs.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const bossUsers = client.db("bossIntroResturant").collection("users");
    const bossItem = client.db("bossIntroResturant").collection("bossMenu");
    const bossReviewItem = client
      .db("bossIntroResturant")
      .collection("bossReviews");
    const cartsReviewItem = client
      .db("bossIntroResturant")
      .collection("cartsReviews");
    const cartsPaymentItem = client
      .db("bossIntroResturant")
      .collection("cartsPayment");

    // JWT

    app.post("/jwt", (req, res) => {
      const user = req.body;
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
      console.log(token);
    });

    //using verify jwt using verify admin

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };
      const user = await bossUsers.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    // Menu collection
    app.get("/menu", async (req, res) => {
      const result = await bossItem.find().toArray();
      res.send(result);
    });

    app.post("/menu", verifyJwt, verifyAdmin, async (req, res) => {
      const newItem = req.body;
      const result = await bossItem.insertOne(newItem);
      res.send(result);
    });

    app.delete("/menu/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await bossItem.deleteOne(query);
      res.send(result);
    });

    app.get("/menu/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await bossItem.findOne(query);
      res.send(result);
    });

    app.patch("/menu/:id", verifyJwt, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id };
      const options = { upsert: true };
      const updateMenu = req.body;
      const menu = {
        $set: {
          name: updateMenu.name,
          category: updateMenu.category,
          price: updateMenu.price,
          recipe: updateMenu.recipe,
        },
      };

      const result = await bossItem.updateOne(filter, menu, options);
      res.send(result);
    });

    // Review collection
    app.get("/review", async (req, res) => {
      const result = await bossReviewItem.find().toArray();
      res.send(result);
    });

    // cart collection
    app.get("/carts", verifyJwt, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.send([]);
      }
      const query = { email: email };
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }

      const result = await cartsReviewItem.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const cartItem = req.body;

      const result = await cartsReviewItem.insertOne(cartItem);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await cartsReviewItem.deleteOne(query);
      res.send(result);
    });

    // Users collection

    app.get("/users", verifyJwt, verifyAdmin, async (req, res) => {
      const result = await bossUsers.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;

      const query = { email: user.email };
      const existingEmail = await bossUsers.findOne(query);

      if (existingEmail) {
        return res.send({ message: "user Existing Already" });
      }
      const result = await bossUsers.insertOne(user);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await bossUsers.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await bossUsers.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/admin/:id", async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) };

      const result = await bossUsers.deleteOne(query);
      res.send(result);
    });

    // payment method intent

    app.post("/create-payment-intent", verifyJwt, async (req, res) => {
      const  {price}  = req.body;
      const amount = parseInt(price * 100);
      console.log(price, amount);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    //payment related api
    app.post("/payments", verifyJwt, async (req, res) => {
      const payment = req.body;

      const result = await cartsPaymentItem.insertOne(payment);
      const query = {
        _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
      };
      const deletedId = await cartsReviewItem.deleteMany(query);
      sendPaymentConfirmationEmail(payment);
      res.send({ result, deletedId });
    });

    app.get("/admin-stats", verifyJwt, verifyAdmin, async (req, res) => {
      const users = await bossUsers.estimatedDocumentCount();
      const products = await bossItem.estimatedDocumentCount();
      const orders = await cartsPaymentItem.estimatedDocumentCount();

      //
      // await paymentCollection.aggregate([
      //   {
      //     $group: {
      //       _id: null,
      //       total: { $sum: '$price' }
      //     }
      //   }
      // ]).toArray()

      const payment = await cartsPaymentItem.find().toArray();
      const revenue = payment.reduce((sum, item) => sum + item.price, 0);

      res.send({
        revenue,
        users,
        products,
        orders,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Boos is Running ${port}`);
});
