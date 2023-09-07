require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const app = express();
const cors = require("cors");
const connection = require("./db");
const userRoutes = require("./routes/users");
const authRoutes = require("./routes/auth");
const getuser = require("./routes/getuser");
const {User} = require("./models/user");

// database connection
connection();
console.log("connected to the db")

// middlewares
app.use(express.json());
app.use(cors());

// routes
app.use("/api/users", userRoutes);
// app.use("/api/user",async (req, res) => {
// 	try {
// 		const token = req.header("Authorization").split(" ")[1];
// 		console.log(token);
// 		const decoded = jwt.verify(token, process.env.JWTPRIVATEKEY);
// 		console.log("decoded token",decoded.email);
// 		const user = await User.findOne({email : decoded.email}).select("-password");
//         console.log("user",user);
// 		// const user = await User.find();
		
// 		if(!user) return res.status(404).send({message:decoded.email});
// 		if(!token) return res.status(401).send({message:"Unauthorized"});
// 		res.status(200).send({ data: user });
// 	} catch (error) {
// 		res.status(500).send({ message: "Internal Server Error",error:error.message });
// 	}
// });

app.use("/api/user", async (req, res) => {
    try {
      const token = req.header("Authorization").split(" ")[1];
      console.log(token);
      const decoded = jwt.verify(token, process.env.JWTPRIVATEKEY);
      console.log("decoded token", decoded.email);
  
      // Use the decoded user ID to find the user by ID
      const user = await User.findById(decoded._id).select("-password");
      console.log("user", user);
  
      // Check if the user exists
      if (!user) {
        return res.status(404).send({ message: "User not found" });
      }
  
      if (!token) {
        return res.status(401).send({ message: "Unauthorized" });
      }
  
      res.status(200).send({ data: user });
    } catch (error) {
      res.status(500).send({ message: "Internal Server Error", error: error.message });
    }
  });
  

app.use("/api/auth", authRoutes);
app.use("/", (req, res) => {
    res.send("Welcome to the backend");
});

const port = process.env.PORT || 8080;
app.listen(port, console.log(`Listening on port ${port}...`));
