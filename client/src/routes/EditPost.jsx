import { useUser, useAuth } from "@clerk/clerk-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { useEffect, useState } from "react";
import Upload from "../components/Upload";

const fetchPost = async (slug) => {
  const res = await axios.get(`${import.meta.env.VITE_API_URL}/posts/${slug}`);
  return res.data;
};

const EditPost = () => {
  const { isLoaded, user } = useUser();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { slug } = useParams();
  const [value, setValue] = useState("");
  const [cover, setCover] = useState("");
  const [img, setImg] = useState("");
  const [video, setVideo] = useState("");
  const [progress, setProgress] = useState(0);

  const queryClient = useQueryClient();

  const { isLoading, error, data } = useQuery({
    queryKey: ["post", slug],
    queryFn: () => fetchPost(slug),
    enabled: isLoaded && !!user,
  });

  useEffect(() => {
    if (isLoaded && user && data) {
      if (user.publicMetadata.role !== "admin" && data.user.username !== user.username) {
        toast.error("You are not authorized to edit this post!");
        navigate("/");
      } else {
        setValue(data.content);
        setCover({ filePath: data.img });
      }
    }
  }, [isLoaded, user, data, navigate]);

  useEffect(() => {
    if (img.url) {
      setValue((prev) => prev + `<p><img src="${img.url}" alt="Uploaded Image"/></p>`);
    }
  }, [img]);

  useEffect(() => {
    if (video.url) {
      setValue(
        (prev) => prev + `<p><iframe class="ql-video" src="${video.url}" frameborder="0" allowfullscreen></iframe></p>`
      );
    }
  }, [video]);

  const mutation = useMutation({
    mutationFn: async (updatedPost) => {
      const token = await getToken();
      return axios.put(`${import.meta.env.VITE_API_URL}/posts/${slug}`, updatedPost, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Post has been updated!");
      navigate(`/${res.data.slug}`);
      queryClient.invalidateQueries(["post", slug]);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "An error occurred!");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updatedData = {
      img: cover.filePath || "",
      title: formData.get("title"),
      category: formData.get("category"),
      desc: formData.get("desc"),
      content: value,
    };
    mutation.mutate(updatedData);
  };

  if (!isLoaded || isLoading) {
    return <div>Loading...</div>;
  }
  if (error) {
    return <div>Something went wrong! {error.message}</div>;
  }
  if (!data) {
    return <div>Post not found!</div>;
  }

  return (
    <div className="h-[calc(100vh-64px)] md:h-[calc(100vh-80px)] flex flex-col gap-6">
      <h1 className="text-cl font-light">Edit Post</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 flex-1 mb-6">
        <Upload type="image" setProgress={setProgress} setData={setCover}>
          <button
            type="button"
            className="w-max p-2 shadow-md rounded-xl text-sm text-gray-500 bg-white"
          >
            Change cover image
          </button>
        </Upload>
        <input
          className="text-4xl font-semibold bg-transparent outline-none"
          type="text"
          placeholder="Post Title"
          name="title"
          required
          defaultValue={data.title}
        />
        <div className="flex items-center gap-4">
          <label htmlFor="category" className="text-sm">
            Choose a category:
          </label>
          <select
            name="category"
            id="category"
            className="p-2 rounded-xl bg-white shadow-md"
            required
            defaultValue={data.category}
          >
            <option value="general">General</option>
            <option value="web-design">Web Design</option>
            <option value="development">Development</option>
            <option value="databases">Databases</option>
            <option value="seo">Search Engines</option>
            <option value="marketing">Marketing</option>
          </select>
        </div>
        <textarea
          className="p-4 rounded-xl bg-white shadow-md"
          name="desc"
          placeholder="A Short Description"
          required
          defaultValue={data.desc}
        />
        <div className="flex flex-1">
          <div className="flex flex-col gap-2 mr-2">
            <Upload type="image" setProgress={setProgress} setData={setImg}>
              🌆
            </Upload>
            <Upload type="video" setProgress={setProgress} setData={setVideo}>
              ▶️
            </Upload>
          </div>
          <ReactQuill
            theme="snow"
            className="flex-1 rounded-xl bg-white shadow-md"
            value={value}
            onChange={setValue}
            readOnly={0 < progress && progress < 100}
          />
        </div>
        <button
          disabled={mutation.isLoading || (0 < progress && progress < 100)}
          className="bg-blue-800 text-white font-medium rounded-xl mt-4 p-2 w-36 disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {mutation.isLoading ? "Updating..." : "Update"}
        </button>
        <span>Progress: {progress}%</span>
      </form>
    </div>
  );
};

export default EditPost;
