const express = require("express");
const { protect } = require("../middleware/auth");
const Review = require("../models/Review");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();

// Get reviews for a movie
router.get("/movie/:movieId", async (req, res) => {
  try {
    const reviews = await Review.find({ movieId: req.params.movieId })
      .populate("userId", "firstName lastName email")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("Fetch movie reviews error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Add a review
router.post("/", protect, async (req, res) => {
  try {
    const { movieId, rating, comment } = req.body;
    const userId = req.user._id;

    const exists = await Review.findOne({ userId, movieId });
    if (exists) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this movie" });
    }

    const review = await Review.create({ userId, movieId, rating, comment });
    await review.populate("userId", "firstName lastName email");
    res.status(201).json(review);
  } catch (err) {
    if (err?.code === 11000) {
      return res
        .status(400)
        .json({ message: "You have already reviewed this movie" });
    }
    console.error("Create review error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update a review
router.put("/:reviewId", protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const review = await Review.findOneAndUpdate(
      { _id: req.params.reviewId, userId: req.user._id },
      { rating, comment },
      { new: true },
    ).populate("userId", "firstName lastName email");

    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    res.json(review);
  } catch (err) {
    console.error("Update review error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete a review
router.delete("/:reviewId", protect, async (req, res) => {
  try {
    const deleted = await Review.findOneAndDelete({
      _id: req.params.reviewId,
      userId: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Review not found" });
    }
    res.json({ message: "Review deleted" });
  } catch (err) {
    console.error("Delete review error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: get all reviews with movie ratings summary
router.get("/admin/all", protect, adminMiddleware, async (_req, res) => {
  try {
    const reviews = await Review.find({})
      .populate("userId", "firstName lastName email")
      .populate("movieId", "title")
      .sort({ createdAt: -1 });

    const movieRatings = await Review.aggregate([
      {
        $group: {
          _id: "$movieId",
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratings: { $push: "$rating" },
        },
      },
      {
        $lookup: {
          from: "movies",
          localField: "_id",
          foreignField: "_id",
          as: "movie",
        },
      },
      { $unwind: "$movie" },
      {
        $project: {
          movieId: "$_id",
          title: "$movie.title",
          averageRating: { $round: ["$averageRating", 1] },
          totalReviews: 1,
          ratings: 1,
        },
      },
      { $sort: { averageRating: -1 } },
    ]);

    res.json({
      reviews,
      movieRatings,
      totalReviews: reviews.length,
      totalMovies: movieRatings.length,
    });
  } catch (err) {
    console.error("Admin reviews fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Admin: delete any review
router.delete(
  "/admin/:reviewId",
  protect,
  adminMiddleware,
  async (req, res) => {
    try {
      const deleted = await Review.findByIdAndDelete(req.params.reviewId);
      if (!deleted) {
        return res.status(404).json({ message: "Review not found" });
      }
      res.json({ message: "Review deleted successfully" });
    } catch (err) {
      console.error("Admin delete review error:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

module.exports = router;
