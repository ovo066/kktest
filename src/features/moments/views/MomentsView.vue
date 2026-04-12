<template>
  <div class="absolute inset-0 flex flex-col bg-white dark:bg-black overflow-hidden font-sans select-none">

    <!-- App Status Bar Placeholder (transparent) -->
    <div class="statusbar-spacer"></div>

    <!-- App Header -->
    <div class="px-4 py-2 flex items-center justify-between shrink-0 z-20">
      <button class="w-9 h-9 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center" @click="router.push('/')">
        <i class="ph ph-caret-left text-xl text-gray-600 dark:text-white"></i>
      </button>

      <div class="flex items-center gap-6 text-[17px] font-bold">
        <button
          :class="currentTab === 'feed' ? '' : 'text-gray-400 font-medium'"
          @click="currentTab = 'feed'"
        >
          <span v-if="currentTab === 'feed'" class="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">动态</span>
          <span v-else>动态</span>
        </button>
        <button
          :class="currentTab === 'mine' ? '' : 'text-gray-400 font-medium'"
          @click="currentTab = 'mine'"
        >
          <span v-if="currentTab === 'mine'" class="bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">我的</span>
          <span v-else>我的</span>
        </button>
      </div>

      <button class="w-9 h-9 flex items-center justify-center relative" @click="showAIPanel = true">
        <i class="ph ph-magic-wand text-2xl text-purple-500"></i>
      </button>
    </div>

    <!-- Feed Tab -->
    <div v-show="currentTab === 'feed'" class="flex-1 overflow-y-auto no-scrollbar scroll-smooth relative" ref="scrollContainer">

      <!-- Empty State -->
      <div v-if="momentsStore.moments.length === 0" class="flex flex-col items-center justify-center pt-32 pb-20 px-8 text-center">
        <div class="w-32 h-32 mb-6 relative">
          <div class="absolute inset-0 bg-pink-200 dark:bg-pink-900/30 rounded-full blur-2xl animate-pulse"></div>
          <i class="ph-fill ph-shooting-star text-[80px] text-pink-500 relative z-10"></i>
        </div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">朋友圈</h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed max-w-[240px]">
          分享日常，记录生活。<br>发布第一条动态吧！
        </p>
      </div>

      <!-- Feed List -->
      <div v-else class="pb-24 pt-2">
        <div
          v-for="moment in momentsStore.sortedMoments"
          :key="moment.id"
          class="border-b border-gray-100 dark:border-gray-800/50 pb-2 mb-2"
        >
          <div class="px-4 pt-3 pb-1">
            <!-- Header -->
            <div class="flex items-start justify-between mb-3">
              <div class="flex gap-3">
                <div class="relative">
                  <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                    <template v-if="moment.authorAvatar">
                      <img v-if="isImageLikeUrl(moment.authorAvatar)" :src="moment.authorAvatar" class="w-full h-full object-cover">
                      <span v-else class="w-full h-full flex items-center justify-center text-sm">{{ moment.authorAvatar }}</span>
                    </template>
                    <span v-else class="w-full h-full flex items-center justify-center text-gray-500 font-bold">{{ moment.authorName?.[0] }}</span>
                  </div>
                </div>

                <div class="flex flex-col">
                  <span class="font-bold text-[15px] text-gray-900 dark:text-white leading-tight">
                    {{ moment.authorName }}
                  </span>
                  <div class="flex items-center gap-1 text-[12px] text-gray-400 mt-0.5">
                    <span>{{ formatTime(moment.time) }}</span>
                    <span v-if="moment.mood" class="ml-1">{{ moment.mood }}</span>
                  </div>
                </div>
              </div>

              <button class="text-gray-400 p-1" @click="showActionSheet(moment)">
                <i class="ph-bold ph-dots-three text-xl"></i>
              </button>
            </div>

            <!-- Content -->
            <div class="pl-[52px]">
              <p class="text-[15px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap mb-3">
                {{ moment.content }}
              </p>

              <!-- Images -->
              <div v-if="moment.images && moment.images.length > 0" class="mb-3">
                <div class="grid gap-1" :class="imageGridClass(moment.images.length)">
                  <div v-for="(img, idx) in moment.images.slice(0, 9)" :key="idx" class="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    <img :src="img" class="w-full h-full object-cover">
                  </div>
                </div>
              </div>

              <!-- Tags -->
              <div v-if="moment.tags && moment.tags.length > 0" class="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                <span v-for="tag in moment.tags" :key="tag" class="px-2.5 py-1 rounded-full bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 text-xs font-medium">#{{ tag }}</span>
              </div>

              <!-- Action Bar -->
              <div class="flex items-center justify-between pr-4 mt-2">
                <button
                  class="flex items-center gap-1.5 group active:scale-95 transition-transform"
                  @click="focusReply(moment.id)"
                >
                  <i class="ph ph-chat-circle text-[20px] text-gray-500 dark:text-gray-400 group-hover:text-blue-500 transition-colors"></i>
                  <span class="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-blue-500">{{ moment.replies?.length || 0 }}</span>
                </button>

                <button
                  class="flex items-center gap-1.5 group active:scale-95 transition-transform"
                  @click="toggleLike(moment)"
                >
                  <i
                    :class="moment.isLiked ? 'ph-fill ph-heart text-pink-500' : 'ph ph-heart text-gray-500 dark:text-gray-400'"
                    class="text-[20px] transition-colors group-hover:text-pink-500"
                  ></i>
                  <span
                    class="text-xs font-medium transition-colors"
                    :class="moment.isLiked ? 'text-pink-500' : 'text-gray-500 dark:text-gray-400 group-hover:text-pink-500'"
                  >
                    {{ moment.likes || 0 }}
                  </span>
                </button>

                <button class="flex items-center gap-1.5 group active:scale-95 transition-transform" @click="router.push('/moments/' + moment.id)">
                  <i class="ph ph-arrow-square-out text-[20px] text-gray-500 dark:text-gray-400 group-hover:text-green-500 transition-colors"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Replies Preview -->
          <div v-if="moment.replies && moment.replies.length > 0" class="mt-2 ml-[68px] mr-4 bg-gray-50 dark:bg-[#1C1C1E] rounded-xl p-3 space-y-2">
            <div
              v-for="reply in moment.replies.slice(0, 3)"
              :key="reply.id"
              class="text-[13px] leading-snug group/reply"
            >
              <span class="font-bold text-gray-800 dark:text-gray-200">{{ reply.authorName }}:</span>
              <span v-if="reply.replyToAuthorName" class="text-gray-400 ml-1">回复 @{{ reply.replyToAuthorName }}</span>
              <span class="text-gray-600 dark:text-gray-400 ml-1">{{ reply.content }}</span>
              <span class="text-[10px] text-gray-300 ml-2">{{ formatTimeShort(reply.time) }}</span>
              <button
                class="ml-2 opacity-0 group-hover/reply:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                @click="confirmDeleteReply(moment.id, reply.id)"
              >
                <i class="ph-fill ph-x-circle text-sm align-middle"></i>
              </button>
            </div>
            <button v-if="moment.replies.length > 3" class="text-[12px] text-blue-500" @click="router.push('/moments/' + moment.id)">
              查看全部 {{ moment.replies.length }} 条评论
            </button>
          </div>

          <!-- Inline Reply Input -->
          <div class="mt-2 ml-[52px] mr-4 flex items-center gap-2">
            <div class="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0">
               <img v-if="currentUserAvatar" :src="currentUserAvatar" class="w-full h-full object-cover">
               <i v-else class="ph-fill ph-user text-xs text-gray-400 flex items-center justify-center h-full"></i>
            </div>
            <div class="flex-1 relative">
              <input
                :ref="el => { if(el) replyInputRefs[moment.id] = el }"
                v-model="replyInputs[moment.id]"
                type="text"
                placeholder="评论..."
                class="w-full bg-gray-100 dark:bg-[#1C1C1E] rounded-full pl-3 pr-8 py-1.5 text-[13px] outline-none dark:text-white"
                @keyup.enter="submitReply(moment.id)"
              >
              <button
                v-if="replyInputs[moment.id]"
                class="absolute right-1 top-1 text-blue-500 p-0.5"
                @click="submitReply(moment.id)"
              >
                <i class="ph-bold ph-paper-plane-right"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Mine Tab -->
    <div v-show="currentTab === 'mine'" class="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
      <!-- Profile Header -->
      <div class="px-6 pt-6 pb-4">
        <div class="flex items-center gap-4 mb-4">
          <div class="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
            <img v-if="currentUserAvatar" :src="currentUserAvatar" class="w-full h-full object-cover">
            <i v-else class="ph-fill ph-user-circle text-6xl text-gray-300 dark:text-gray-600"></i>
          </div>
          <div class="flex-1">
            <div class="font-bold text-[18px] text-gray-900 dark:text-white">{{ momentsStore.forumUser.name }}</div>
            <div class="text-[13px] text-gray-500 mt-0.5">{{ momentsStore.forumUser.bio || '这个人很懒，什么都没写' }}</div>
          </div>
          <button class="px-3 py-1 rounded-full text-[12px] font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400" @click="openEditProfile">
            编辑
          </button>
        </div>
        <div class="flex gap-6 text-center">
          <div>
            <div class="text-[18px] font-bold text-gray-900 dark:text-white">{{ myMoments.length }}</div>
            <div class="text-[11px] text-gray-400">动态</div>
          </div>
          <div>
            <div class="text-[18px] font-bold text-gray-900 dark:text-white">{{ totalLikes }}</div>
            <div class="text-[11px] text-gray-400">获赞</div>
          </div>
        </div>
      </div>

      <!-- My Moments -->
      <div class="border-t border-gray-100 dark:border-gray-800">
        <div v-if="myMoments.length === 0" class="py-12 text-center text-gray-400 text-sm">
          还没有发布动态
        </div>
        <div v-for="m in myMoments" :key="m.id" class="px-4 py-3 border-b border-gray-50 dark:border-gray-800/50">
          <p class="text-[14px] text-gray-700 dark:text-gray-300 line-clamp-3">{{ m.content }}</p>
          <div class="flex items-center gap-3 mt-2 text-[12px] text-gray-400">
            <span>{{ formatTime(m.time) }}</span>
            <span>{{ m.likes || 0 }} 赞</span>
            <span>{{ m.replies?.length || 0 }} 评论</span>
            <button class="ml-auto text-red-400" @click="confirmDeleteMoment(m.id)">
              <i class="ph ph-trash text-sm"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Navigation Bar -->
    <div class="h-[88px] bg-white/80 dark:bg-black/80 backdrop-blur-lg border-t border-gray-100 dark:border-white/5 flex items-center justify-around shrink-0 z-20 pb-app px-8">
      <!-- Feed -->
      <div class="flex flex-col items-center gap-1 cursor-pointer group flex-1" @click="currentTab = 'feed'">
        <div class="w-10 h-10 flex items-center justify-center rounded-full transition-all" :class="currentTab === 'feed' ? 'text-gray-900 dark:text-white' : 'text-gray-400'">
          <i class="ph-fill ph-shooting-star text-[28px]"></i>
        </div>
        <span class="text-[10px] font-bold tracking-tight">动态</span>
      </div>

      <!-- Center Post Button -->
      <div class="flex-1 flex justify-center items-center relative -top-4">
        <div class="absolute w-16 h-16 bg-gradient-to-tr from-pink-500/20 to-purple-500/20 rounded-full blur-xl animate-pulse"></div>
        <button
          class="w-14 h-14 bg-gradient-to-tr from-pink-400 via-pink-500 to-violet-600 rounded-full shadow-[0_8px_25px_rgba(236,72,153,0.35)] flex items-center justify-center text-white active:scale-90 transition-all duration-300 relative border-4 border-white dark:border-black group overflow-hidden"
          @click="showNewPost = true"
        >
          <div class="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <i class="ph-bold ph-plus text-2xl relative z-10"></i>
        </button>
      </div>

      <!-- Mine -->
      <div class="flex flex-col items-center gap-1 cursor-pointer group flex-1" :class="currentTab === 'mine' ? 'text-gray-900 dark:text-white' : 'text-gray-400'" @click="currentTab = 'mine'">
        <div class="w-10 h-10 flex items-center justify-center rounded-full transition-all">
          <i class="ph-bold ph-user text-[28px]"></i>
        </div>
        <span class="text-[10px] font-bold tracking-tight">我的</span>
      </div>
    </div>

    <!-- New Moment Modal -->
    <div v-if="showNewPost" class="absolute inset-0 z-50 flex flex-col bg-white dark:bg-[#1C1C1E]">
      <div class="px-4 pt-app pb-2 flex items-center justify-between">
        <button class="text-[16px] text-gray-600 dark:text-gray-400" @click="showNewPost = false">取消</button>
        <button
          class="bg-pink-500 text-white text-[14px] font-bold px-5 py-1.5 rounded-full disabled:opacity-50 disabled:scale-100 active:scale-95 transition-all"
          :disabled="!newPost.content.trim()"
          @click="submitPost"
        >
          发布
        </button>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-2">
        <!-- Identity Selector -->
        <div class="flex items-center gap-3 mb-4 overflow-x-auto no-scrollbar py-2">
          <div
            class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer"
            :class="newPost.authorType === 'user' ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20' : 'border-gray-200 dark:border-gray-700'"
            @click="newPost.authorType = 'user'"
          >
             <div class="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                <img v-if="currentUserAvatar" :src="currentUserAvatar" class="w-full h-full object-cover">
             </div>
             <span class="text-sm font-medium whitespace-nowrap" :class="newPost.authorType === 'user' ? 'text-pink-600 dark:text-pink-400' : 'text-gray-600 dark:text-gray-300'">{{ momentsStore.forumUser?.name || '本体' }}</span>
           </div>

          <div
             v-for="c in forumContacts"
            :key="c.id"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all cursor-pointer"
            :class="newPost.authorType === 'contact:' + c.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-gray-200 dark:border-gray-700'"
            @click="newPost.authorType = 'contact:' + c.id"
          >
             <div class="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                <template v-if="c.avatar">
                   <img v-if="isImageLikeUrl(c.avatar)" :src="c.avatar" class="w-full h-full object-cover">
                   <span v-else class="flex items-center justify-center w-full h-full text-[10px]">{{ c.avatar }}</span>
                </template>
             </div>
             <span class="text-sm font-medium whitespace-nowrap" :class="newPost.authorType === 'contact:' + c.id ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-300'">{{ c.name }}</span>
          </div>
        </div>

        <!-- Mood Selector -->
        <div class="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
          <span class="text-[12px] text-gray-400 shrink-0">心情</span>
          <button
            v-for="emoji in moods" :key="emoji"
            class="w-8 h-8 rounded-full flex items-center justify-center transition-all text-lg"
            :class="newPost.mood === emoji ? 'bg-pink-100 dark:bg-pink-900/30 scale-110' : 'hover:bg-gray-100 dark:hover:bg-gray-800'"
            @click="newPost.mood = newPost.mood === emoji ? '' : emoji"
          >{{ emoji }}</button>
        </div>

        <textarea
          v-model="newPost.content"
          class="w-full h-[35vh] text-[16px] leading-relaxed text-gray-800 dark:text-gray-200 placeholder-gray-400 outline-none resize-none bg-transparent"
          placeholder="分享你的想法..."
        ></textarea>

        <!-- Toolbar -->
        <div class="flex gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-white/10 text-2xl text-gray-400">
           <i class="ph ph-image"></i>
           <i class="ph ph-hash"></i>
           <i class="ph ph-smiley"></i>
        </div>
      </div>
    </div>

    <!-- Edit Profile Modal -->
    <div v-if="showEditProfile" class="absolute inset-0 z-50 flex flex-col bg-white dark:bg-[#1C1C1E]">
      <div class="px-4 pt-app pb-2 flex items-center justify-between">
        <button class="text-[16px] text-gray-600 dark:text-gray-400" @click="closeEditProfile">取消</button>
        <button class="text-[16px] text-blue-500 font-bold" @click="saveProfile">保存</button>
      </div>
      <div class="flex-1 px-5 py-4 space-y-4">
        <div class="flex flex-col items-center gap-2 mb-4">
          <label class="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden cursor-pointer relative">
            <img v-if="editProfile.avatar" :src="editProfile.avatar" class="w-full h-full object-cover">
            <i v-else class="ph-fill ph-camera text-3xl text-gray-400 absolute inset-0 flex items-center justify-center"></i>
            <input type="file" accept="image/*" class="hidden" @change="onAvatarPick">
          </label>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">点击更换头像</span>
            <button class="text-xs text-blue-500" @click="handleProfileAvatarUrlInput">填URL</button>
          </div>
        </div>
        <div>
          <label class="text-xs text-gray-400 mb-1 block">昵称</label>
          <input v-model="editProfile.name" class="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 text-[15px] outline-none dark:text-white" placeholder="你的昵称">
        </div>
        <div>
          <label class="text-xs text-gray-400 mb-1 block">简介</label>
          <textarea v-model="editProfile.bio" rows="2" class="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-2 text-[15px] outline-none dark:text-white resize-none" placeholder="一句话介绍自己"></textarea>
        </div>
      </div>
    </div>

    <!-- AI Generate Panel -->
    <div v-if="showAIPanel" class="absolute inset-0 z-50 flex flex-col bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl">
      <!-- Header -->
      <div class="px-5 pt-app pb-4 flex items-center justify-between z-10">
        <button
          class="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-200 dark:hover:bg-white/20"
          @click="showAIPanel = false"
        >
          <i class="ph-bold ph-x"></i>
        </button>
        <div class="flex flex-col items-center">
           <span class="font-bold text-[18px] bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">灵感织造</span>
           <span class="text-[10px] text-gray-400 tracking-widest uppercase">AI Creation</span>
        </div>
        <div class="w-8"></div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto px-6 py-2 space-y-8 relative z-0">
        <!-- Background Orbs -->
        <div class="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-purple-400/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div class="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-pink-400/20 rounded-full blur-[80px] pointer-events-none"></div>

        <!-- 1. Select Role -->
        <div class="space-y-3 relative">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">织造者 (Role)</label>
          <div class="flex gap-4 overflow-x-auto no-scrollbar py-2 -mx-2 px-2">
             <div
               v-for="c in forumContacts"
               :key="c.id"
               class="flex flex-col items-center gap-2 cursor-pointer group min-w-[64px]"
               @click="aiGenerate.contactId = c.id"
             >
                <div
                  class="w-16 h-16 rounded-full p-[2px] transition-all duration-300"
                  :class="aiGenerate.contactId === c.id ? 'bg-gradient-to-tr from-pink-500 to-violet-500 shadow-lg shadow-purple-500/30 scale-110' : 'bg-gray-100 dark:bg-gray-800 grayscale hover:grayscale-0'"
                >
                   <div class="w-full h-full rounded-full bg-white dark:bg-[#1C1C1E] p-[2px] overflow-hidden">
                      <template v-if="c.avatar">
                         <img v-if="isImageLikeUrl(c.avatar)" :src="c.avatar" class="w-full h-full object-cover rounded-full">
                         <span v-else class="flex items-center justify-center w-full h-full text-xs">{{ c.avatar }}</span>
                      </template>
                      <span v-else class="flex items-center justify-center w-full h-full text-xs font-bold">{{ c.name[0] }}</span>
                   </div>
                </div>
                <span
                  class="text-[11px] font-medium transition-colors text-center truncate w-full"
                  :class="aiGenerate.contactId === c.id ? 'text-gray-900 dark:text-white' : 'text-gray-400'"
                >
                  {{ c.name }}
                </span>
             </div>
          </div>
        </div>

        <!-- 2. Select Type -->
        <div class="space-y-3 relative">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">类型 (Type)</label>
          <div class="bg-gray-100 dark:bg-white/5 p-1 rounded-2xl flex relative">
            <div
               class="absolute inset-y-1 w-1/2 bg-white dark:bg-[#2C2C2E] rounded-xl shadow-sm transition-all duration-300"
               :style="{ left: aiGenerate.type === 'post' ? '4px' : 'calc(50% - 4px)' }"
            ></div>
            <button
              class="flex-1 relative z-10 py-2.5 text-sm font-medium transition-colors text-center"
              :class="aiGenerate.type === 'post' ? 'text-gray-900 dark:text-white' : 'text-gray-400'"
              @click="aiGenerate.type = 'post'"
            >
              发动态
            </button>
            <button
              class="flex-1 relative z-10 py-2.5 text-sm font-medium transition-colors text-center"
              :class="aiGenerate.type === 'reply' ? 'text-gray-900 dark:text-white' : 'text-gray-400'"
              @click="aiGenerate.type = 'reply'"
            >
              评论动态
            </button>
          </div>
        </div>

        <!-- 3. Target Moment (If Reply) -->
        <div v-if="aiGenerate.type === 'reply'" class="space-y-3 relative">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">目标动态 (Target)</label>
          <div class="flex gap-3 overflow-x-auto no-scrollbar py-1 -mx-2 px-2">
            <div
              v-for="p in momentsStore.sortedMoments.slice(0, 10)"
              :key="p.id"
              class="min-w-[200px] max-w-[200px] p-3 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2"
              :class="aiGenerate.postId === p.id ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500' : 'border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 opacity-60'"
              @click="aiGenerate.postId = p.id"
            >
              <div class="flex items-center gap-2">
                <div class="w-5 h-5 rounded-full bg-gray-300 overflow-hidden shrink-0">
                  <img v-if="isImageLikeUrl(p.authorAvatar)" :src="p.authorAvatar" class="w-full h-full object-cover">
                </div>
                <span class="text-[11px] font-bold truncate text-gray-700 dark:text-gray-300">{{ p.authorName }}</span>
              </div>
              <p class="text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug">{{ p.content }}</p>
            </div>
          </div>
        </div>

        <!-- 4. Prompt -->
        <div class="space-y-3 relative">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">灵感指引 (Prompt)</label>
          <div class="relative group">
            <div class="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
            <textarea
              v-model="aiGenerate.prompt"
              rows="3"
              class="w-full relative bg-gray-100 dark:bg-white/5 border border-transparent focus:bg-white dark:focus:bg-[#2C2C2E] rounded-2xl px-4 py-3 outline-none dark:text-white text-[15px] resize-none transition-all placeholder-gray-400"
              placeholder="想让 Ta 分享什么？（留空则自由发挥）"
            ></textarea>
          </div>
        </div>

        <!-- 5. Chain Generate -->
        <div v-if="aiGenerate.type === 'post' || aiGenerate.type === 'reply'" class="space-y-3 relative">
          <label class="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">连续互动 (Chain)</label>
          <div class="bg-gray-100 dark:bg-white/5 rounded-2xl p-4 space-y-4 border border-transparent">
            <div class="flex items-center justify-between gap-4">
              <div class="flex flex-col">
                <span class="text-[15px] font-medium text-gray-900 dark:text-white">{{ aiGenerate.type === 'post' ? '生成后自动评论' : '评论后继续互动' }}</span>
                <span class="text-[12px] text-gray-500 dark:text-gray-400">{{ aiGenerate.type === 'post' ? '勾选多个角色，瞬间营造氛围' : '让多个角色一起评论这条动态' }}</span>
              </div>
              <IosToggle v-model="aiGenerate.autoReplyEnabled" activeColor="#AF52DE" />
            </div>

            <div v-if="aiGenerate.autoReplyEnabled" class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">参与角色</span>
                <div class="flex items-center gap-3">
                  <button class="text-[12px] text-[#007AFF]" @click="selectAllAutoReplyContacts">全选</button>
                  <button class="text-[12px] text-[#007AFF]" @click="clearAutoReplyContacts">清空</button>
                </div>
              </div>

              <div class="flex flex-wrap gap-2">
                <button
                  v-for="c in forumContacts.filter(x => x.id !== aiGenerate.contactId)"
                  :key="c.id"
                  class="px-3 py-1.5 rounded-full text-[12px] font-medium transition-all"
                  :class="[
                    aiGenerate.autoReplyContactIds.includes(c.id)
                      ? 'bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-sm'
                      : 'bg-white/80 dark:bg-white/10 text-gray-700 dark:text-gray-300',
                    (!canJoinAutoReply(c.id) && aiGenerate.useAcquaintanceGroups) ? 'opacity-40 cursor-not-allowed' : ''
                  ]"
                  :disabled="!canJoinAutoReply(c.id)"
                  @click="toggleAutoReplyContact(c.id)"
                >
                  {{ c.name }}
                </button>
              </div>

              <div class="flex items-center justify-between gap-4">
                <div class="flex flex-col">
                  <span class="text-[13px] text-gray-700 dark:text-gray-200">角色互相回复</span>
                  <span class="text-[12px] text-gray-500 dark:text-gray-400">开启后会部分回复已有评论，更像真实评论区</span>
                </div>
                <IosToggle v-model="aiGenerate.autoReplyThreaded" activeColor="#34C759" />
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <span class="text-[12px] text-gray-500 dark:text-gray-400">轮次</span>
                  <input
                    v-model.number="aiGenerate.autoReplyRounds"
                    type="number"
                    min="1"
                    max="5"
                    class="w-full bg-white dark:bg-[#2C2C2E] rounded-xl px-3 py-2 text-[14px] outline-none dark:text-white"
                  >
                </div>
                <div class="flex flex-col gap-1">
                  <span class="text-[12px] text-gray-500 dark:text-gray-400">氛围</span>
                  <select
                    v-model="aiGenerate.autoReplyVibe"
                    class="w-full bg-white dark:bg-[#2C2C2E] rounded-xl px-3 py-2 text-[14px] outline-none dark:text-white"
                  >
                    <option value="drama">修罗场</option>
                    <option value="friendly">其乐融融</option>
                    <option value="neutral">中立</option>
                  </select>
                </div>
              </div>

              <textarea
                v-model="aiGenerate.autoReplyPrompt"
                rows="2"
                class="w-full bg-white dark:bg-[#2C2C2E] rounded-xl px-3 py-2 text-[14px] outline-none dark:text-white resize-none placeholder-gray-400"
                placeholder="评论额外提示（可选）"
              ></textarea>
            </div>

            <div class="space-y-3 pt-1 border-t border-gray-200/60 dark:border-white/10">
              <div class="flex items-center justify-between gap-4">
                <div class="flex flex-col">
                  <span class="text-[13px] text-gray-700 dark:text-gray-200">仅熟人互动</span>
                  <span class="text-[12px] text-gray-500 dark:text-gray-400">只允许同分组联系人互相评论/回复</span>
                </div>
                <IosToggle v-model="aiGenerate.useAcquaintanceGroups" activeColor="#0EA5E9" />
              </div>

              <div class="rounded-xl bg-white/80 dark:bg-white/10 p-3 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-[12px] font-semibold text-gray-500 dark:text-gray-400">联系人分组</span>
                  <button class="text-[12px] text-[#007AFF]" @click="addAcquaintanceGroup">新建分组</button>
                </div>

                <div v-if="relationGroups.length > 0" class="space-y-2">
                  <div
                    v-for="g in relationGroups"
                    :key="g.id"
                    class="flex items-center gap-2"
                  >
                    <input
                      :value="g.name"
                      class="flex-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-lg px-2.5 py-1.5 text-[12px] outline-none dark:text-white"
                      @input="renameAcquaintanceGroup(g.id, $event.target.value)"
                    >
                    <button class="text-[12px] text-red-500" @click="removeAcquaintanceGroup(g.id)">删除</button>
                  </div>
                </div>
                <div v-else class="text-[12px] text-gray-400">暂无分组，点击“新建分组”创建。</div>

                <div class="space-y-2">
                  <div class="text-[12px] text-gray-500 dark:text-gray-400">联系人归属</div>
                  <div
                    v-for="c in forumContacts"
                    :key="'group-map-' + c.id"
                    class="flex items-center gap-2"
                  >
                    <span class="text-[12px] text-gray-700 dark:text-gray-300 w-[72px] truncate">{{ c.name }}</span>
                    <select
                      class="flex-1 bg-gray-100 dark:bg-[#2C2C2E] rounded-lg px-2.5 py-1.5 text-[12px] outline-none dark:text-white"
                      :value="getContactGroupId(c.id)"
                      @change="onContactGroupChange(c.id, $event.target.value)"
                    >
                      <option value="">未分组</option>
                      <option v-for="g in relationGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Generate Button -->
        <div class="pt-4 pb-8">
          <button
            class="w-full relative overflow-hidden bg-black dark:bg-white text-white dark:text-black rounded-2xl py-4 font-bold text-[16px] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            :disabled="aiGenerating || !aiGenerate.contactId"
            @click="generateWithAI"
          >
            <div class="absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>

            <i v-if="aiGenerating" class="ph-bold ph-spinner animate-spin text-xl"></i>
            <i v-else class="ph-fill ph-sparkle text-xl text-pink-500 dark:text-pink-600 group-hover:scale-110 transition-transform"></i>
            <span>{{ aiGenerating ? (aiGeneratingText || '正在编织梦境...') : '开始织造' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useContactsStore } from '../../../stores/contacts'
import { useConfigsStore } from '../../../stores/configs'
import { useMomentsStore } from '../../../stores/moments'
import { useStorage } from '../../../composables/useStorage'
import { showConfirm } from '../../../composables/useConfirm'
import { formatRelativeTime } from '../../../utils/relativeTime'
import { resolveSocialAuthor } from '../../../utils/socialAuthors'
import IosToggle from '../../../components/common/IosToggle.vue'
import { useMomentsProfileEditor } from '../composables/useMomentsProfileEditor'
import { useMomentsAIGeneration } from '../composables/useMomentsAIGeneration'

const router = useRouter()
const contactsStore = useContactsStore()
const configsStore = useConfigsStore()
const momentsStore = useMomentsStore()
const { scheduleSave } = useStorage()
const forumContacts = computed(() => contactsStore.contacts.filter(c => c.type !== 'group'))
const aiContactIdSet = computed(() => new Set(forumContacts.value.map(c => c.id)))
const relationGroups = computed(() => momentsStore.contactGroups || [])

const currentTab = ref('feed')
const showNewPost = ref(false)
const showAIPanel = ref(false)
const moods = ['😊', '😢', '😡', '🥰', '😴', '🤔', '🎉', '🌸']

const newPost = reactive({ content: '', authorType: 'user', mood: '' })
const replyInputs = reactive({})
const replyInputRefs = reactive({})
const {
  closeEditProfile,
  editProfile,
  handleProfileAvatarUrlInput,
  onAvatarPick,
  openEditProfile,
  saveProfile,
  showEditProfile
} = useMomentsProfileEditor({
  momentsStore,
  scheduleSave
})
const {
  addAcquaintanceGroup,
  aiGenerate,
  aiGenerating,
  aiGeneratingText,
  canJoinAutoReply,
  clearAutoReplyContacts,
  generateWithAI,
  getContactGroupId,
  onContactGroupChange,
  removeAcquaintanceGroup,
  renameAcquaintanceGroup,
  selectAllAutoReplyContacts,
  toggleAutoReplyContact
} = useMomentsAIGeneration({
  configsStore,
  forumContacts,
  aiContactIdSet,
  momentsStore,
  scheduleSave,
  showAIPanel
})

function isImageLikeUrl(value) {
  const text = String(value || '').trim()
  return text.startsWith('data:') || text.startsWith('blob:') || /^https?:\/\//i.test(text)
}

const currentUserAvatar = computed(() => {
  const avatar = momentsStore.forumUser?.avatar
  if (isImageLikeUrl(avatar)) return avatar
  return null
})

const myMoments = computed(() => {
  const userId = momentsStore.forumUser?.id
  return momentsStore.sortedMoments.filter(m => m.authorId === userId)
})

const totalLikes = computed(() => {
  return myMoments.value.reduce((sum, m) => sum + (m.likes || 0), 0)
})

function imageGridClass(count) {
  if (count === 1) return 'grid-cols-1 max-w-[200px]'
  if (count <= 4) return 'grid-cols-2 max-w-[240px]'
  return 'grid-cols-3 max-w-[300px]'
}

function formatTime(ts) {
  return formatRelativeTime(ts)
}

function formatTimeShort(ts) {
  return formatRelativeTime(ts, { short: true })
}

function getAuthorInfo(authorType) {
  return resolveSocialAuthor(authorType, momentsStore.forumUser, contactsStore.contacts)
}

function submitPost() {
  if (!newPost.content.trim()) return
  const author = getAuthorInfo(newPost.authorType || 'user')
  momentsStore.addMoment({
    content: newPost.content.trim(),
    mood: newPost.mood || null,
    authorId: author.id,
    authorName: author.name,
    authorAvatar: author.avatar
  })
  newPost.content = ''
  newPost.mood = ''
  newPost.authorType = 'user'
  showNewPost.value = false
  scheduleSave()
}

function toggleLike(moment) {
  momentsStore.likeMoment(moment.id)
  scheduleSave()
}

function focusReply(momentId) {
  const input = replyInputRefs[momentId]
  if (input) input.focus()
}

function submitReply(momentId) {
  const content = replyInputs[momentId]?.trim()
  if (!content) return
  const author = getAuthorInfo('user')
  momentsStore.addReply(momentId, {
    content,
    authorId: author.id,
    authorName: author.name,
    authorAvatar: author.avatar
  })
  replyInputs[momentId] = ''
  scheduleSave()
}

async function showActionSheet(moment) {
  const ok = await showConfirm({ title: '删除动态', message: '确定要删除这条动态吗？', destructive: true })
  if (ok) {
    momentsStore.deleteMoment(moment.id)
    scheduleSave()
  }
}

async function confirmDeleteMoment(id) {
  const ok = await showConfirm({ title: '删除动态', message: '确定要删除这条动态吗？', destructive: true })
  if (ok) {
    momentsStore.deleteMoment(id)
    scheduleSave()
  }
}

async function confirmDeleteReply(momentId, replyId) {
  const ok = await showConfirm({ title: '删除评论', message: '确定要删除这条评论吗？', destructive: true })
  if (ok) {
    momentsStore.deleteReply(momentId, replyId)
    scheduleSave()
  }
}

</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
