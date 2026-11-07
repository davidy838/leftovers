import type { Metadata } from "next";
import { PostForm } from "@/components/PostForm";

export const metadata: Metadata = { title: "Post food · Leftovers" };

export default function PostPage() {
  return <PostForm />;
}
