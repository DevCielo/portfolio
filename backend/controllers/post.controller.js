import ImageKit from "imagekit";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";

export const getPosts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 2;

  const query = {};

  console.log(req.query);

  const cat = req.query.cat;
  const author = req.query.author;
  const searchQuery = req.query.search;
  const sortQuery = req.query.sort;
  const featured = req.query.featured;

  if (cat) {
    query.category = cat;
  }

  if (searchQuery) {
    query.title = { $regex: searchQuery, $options: "i" };
  }

  if (author) {
    const user = await User.findOne({ username: author }).select("_id");

    if (!user) {
      return res.status(404).json("No post found!");
    }

    query.user = user._id;
  }

  let sortObj = { createdAt: -1 };

  if (sortQuery) {
    switch (sortQuery) {
      case "newest":
        sortObj = { createdAt: -1 };
        break;
      case "oldest":
        sortObj = { createdAt: 1 };
        break;
      case "popular":
        sortObj = { visit: -1 };
        break;
      case "trending":
        sortObj = { visit: -1 };
        query.createdAt = {
          $gte: new Date(new Date().getTime() - 7 * 24 * 60 * 60 * 1000),
        };
        break;
      default:
        break;
    }
  }

  if (featured) {
    query.isFeatured = true;
  }

  const posts = await Post.find(query)
    .populate("user", "username")
    .sort(sortObj)
    .limit(limit)
    .skip((page - 1) * limit);

  const totalPosts = await Post.countDocuments();
  const hasMore = page * limit < totalPosts;

  res.status(200).json({ posts, hasMore });
};

export const getPost = async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug }).populate(
    "user",
    "username img"
  );
  res.status(200).json(post);
};

export const createPost = async (req, res) => {
  const clerkUserId = req.auth.userId;

  console.log(req.headers);

  if (!clerkUserId) {
    return res.status(401).json("Not authenticated!");
  }

  const user = await User.findOne({ clerkUserId });

  if (!user) {
    return res.status(404).json("User not found!");
  }

  let slug = req.body.title.replace(/ /g, "-").toLowerCase();

  let existingPost = await Post.findOne({ slug });

  let counter = 2;

  while (existingPost) {
    slug = `${slug}-${counter}`;
    existingPost = await Post.findOne({ slug });
    counter++;
  }

  const newPost = new Post({ user: user._id, slug, ...req.body });

  const post = await newPost.save();
  res.status(200).json(post);
};

export const deletePost = async (req, res) => {
  const clerkUserId = req.auth.userId;

  if (!clerkUserId) {
    return res.status(401).json("Not authenticated!");
  }

  const role = req.auth.sessionClaims?.metadata?.role || "user";

  if (role === "admin") {
    await Post.findByIdAndDelete(req.params.id);
    return res.status(200).json("Post has been deleted");
  }

  const user = await User.findOne({ clerkUserId });

  const deletedPost = await Post.findOneAndDelete({
    _id: req.params.id,
    user: user._id,
  });

  if (!deletedPost) {
    return res.status(403).json("You can delete only your posts!");
  }

  res.status(200).json("Post has been deleted");
};

export const featurePost = async (req, res) => {
  const clerkUserId = req.auth.userId;
  const postId = req.body.postId;

  if (!clerkUserId) {
    return res.status(401).json("Not authenticated!");
  }

  const role = req.auth.sessionClaims?.metadata?.role || "user";

  if (role !== "admin") {
    return res.status(403).json("You cannot feature posts!");
  }

  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json("Post not found!");
  }

  const isFeatured = post.isFeatured;

  const updatedPost = await Post.findByIdAndUpdate(
    postId,
    {
      isFeatured: !isFeatured,
    },
    { new: true }
  );

  res.status(200).json(updatedPost);
};

export const updatePost = async (req, res) => {
    try {
      const clerkUserId = req.auth.userId;
  
      if (!clerkUserId) {
        return res.status(401).json({ message: "Not authenticated!" });
      }
  
      const role = req.auth.sessionClaims?.metadata?.role || "user";
  
      // Find the post by slug
      const post = await Post.findOne({ slug: req.params.slug });
  
      if (!post) {
        return res.status(404).json({ message: "Post not found!" });
      }
  
      // Find the user making the request
      const user = await User.findOne({ clerkUserId });
  
      if (!user) {
        return res.status(404).json({ message: "User not found!" });
      }
  
      // Check if the user is authorized to update the post
      if (role !== "admin" && post.user.toString() !== user._id.toString()) {
        return res.status(403).json({ message: "You are not authorized to update this post!" });
      }
  
      const { title, category, desc, content, img } = req.body;
      const updatedFields = {};
  
      if (title && title !== post.title) {
        // Update the slug if the title has changed
        let newSlug = title.replace(/ /g, "-").toLowerCase();
        let existingPost = await Post.findOne({ slug: newSlug });
        let counter = 2;
  
        while (existingPost && existingPost._id.toString() !== post._id.toString()) {
          newSlug = `${newSlug}-${counter}`;
          existingPost = await Post.findOne({ slug: newSlug });
          counter++;
        }
  
        updatedFields.slug = newSlug;
        updatedFields.title = title;
      }
  
      if (category) updatedFields.category = category;
      if (desc) updatedFields.desc = desc;
      if (content) updatedFields.content = content;
      if (img) updatedFields.img = img;
  
      const updatedPost = await Post.findOneAndUpdate(
        { slug: req.params.slug },
        { $set: updatedFields },
        { new: true }
      ).populate("user", "username img");
  
      res.status(200).json(updatedPost);
    } catch (error) {
      console.error("Error updating post:", error);
      res.status(500).json({ message: "Internal server error!" });
    }
  };

const imagekit = new ImageKit({
  urlEndpoint: process.env.IK_URL_ENDPOINT,
  publicKey: process.env.IK_PUBLIC_KEY,
  privateKey: process.env.IK_PRIVATE_KEY,
});

export const uploadAuth = async (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
};